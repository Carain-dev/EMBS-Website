if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';

/* CMS values are plain text typed by editors (and subscriber emails come from
   the public form): escape them before they go into innerHTML, and only allow
   http(s) links, so stored markup cannot run script in an admin's session. */
function admEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function admHref(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? admEsc(String(u).trim()) : ''; }
'use strict';

const API   = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ Authorization: `Bearer ${TOKEN()}` });
const jsonH = () => ({ 'Content-Type': 'application/json', ...authH() });

/* ── Sidebar toggle ─────────────────────────── */
const sidebar  = document.getElementById('sidebar');
const toggle   = document.getElementById('sidebarToggle');
const overlay  = document.getElementById('sidebarOverlay');
toggle.addEventListener('click',  () => { sidebar.classList.toggle('open');  overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let subscribers  = [];
let unsubTarget  = null;

/* ── Load subscribers ────────────────────────── */
async function loadSubscribers() {
  try {
    const res  = await fetch(`${API}/newsletter`, { headers: authH() });
    const data = await res.json();
    subscribers = data.data || [];
    renderTable();
    updateCount();
  } catch {
    showToast('Failed to load subscribers.', 'error');
  }
}

function updateCount() {
  const el = document.getElementById('subscriberCount');
  if (el) el.textContent = subscribers.length;
  const tc = document.getElementById('tableCount');
  if (tc) tc.textContent = `${subscribers.length} subscriber${subscribers.length !== 1 ? 's' : ''}`;
}

/* ── Render subscriber table ─────────────────── */
function renderTable() {
  const tbody = document.getElementById('subscribersTableBody');
  const empty = document.getElementById('tableEmpty');

  if (!subscribers.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = subscribers.map(s => {
    const date = s.createdAt
      ? new Date(s.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    return `<tr>
      <td style="font-size:0.85rem;">${admEsc(s.email)}</td>
      <td style="font-size:0.8rem;color:var(--text-muted);">${date}</td>
      <td><button class="action-btn action-btn--delete" onclick="openUnsubModal(${admEsc(JSON.stringify(String(s.email)))})">
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        Remove
      </button></td>
    </tr>`;
  }).join('');
}

/* ── Compose / Send ──────────────────────────── */
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('nlSubject').value = '';
  document.getElementById('nlText').value    = '';
});

document.getElementById('sendBtn').addEventListener('click', () => {
  const subject = document.getElementById('nlSubject').value.trim();
  const text    = document.getElementById('nlText').value.trim();
  if (!subject) { showToast('Subject is required.', 'error');  return; }
  if (!text)    { showToast('Message content is required.', 'error'); return; }
  if (!subscribers.length) { showToast('No subscribers to send to.', 'error'); return; }

  const desc = document.getElementById('sendModalDesc');
  if (desc) desc.textContent =
    `This will send "${subject}" to ${subscribers.length} subscriber${subscribers.length !== 1 ? 's' : ''}. This cannot be undone.`;

  document.getElementById('sendModal').style.display = 'flex';
});

document.getElementById('cancelSend').addEventListener('click', () => {
  document.getElementById('sendModal').style.display = 'none';
});
document.getElementById('sendModal').addEventListener('click', e => {
  if (e.target === document.getElementById('sendModal'))
    document.getElementById('sendModal').style.display = 'none';
});

document.getElementById('confirmSend').addEventListener('click', async () => {
  document.getElementById('sendModal').style.display = 'none';

  const subject = document.getElementById('nlSubject').value.trim();
  const text    = document.getElementById('nlText').value.trim();

  /* Build a simple styled HTML version from the plain-text content */
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e1a;color:#e8eaf6;padding:32px;border-radius:12px;">
      <div style="border-bottom:2px solid #6B2D8B;padding-bottom:12px;margin-bottom:24px;">
        <h2 style="color:#00A99D;margin:0;font-size:1.2rem;">IEEE EMBS Student Chapter</h2>
        <h1 style="color:#e8eaf6;margin:8px 0 0;font-size:1.5rem;">${subject}</h1>
      </div>
      <div style="font-size:0.95rem;line-height:1.8;white-space:pre-line;">${text}</div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(107,45,139,0.3);
                  font-size:0.75rem;color:rgba(200,210,230,0.4);">
        You received this email because you subscribed to the IEEE EMBS newsletter.<br/>
        To unsubscribe, reply to this email or visit our website.
      </div>
    </div>`;

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled    = true;
  sendBtn.textContent = 'Sending…';

  try {
    const res  = await fetch(`${API}/newsletter/send`, {
      method:  'POST',
      headers: jsonH(),
      body:    JSON.stringify({ subject, html, text }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Send failed');

    const { sent, failed } = data.data || {};
    if (failed > 0) {
      showToast(`Sent: ${sent}, Failed: ${failed}. Check the server logs.`, 'error');
    } else {
      showToast(`Newsletter sent to ${sent} subscriber${sent !== 1 ? 's' : ''} successfully!`, 'success');
      document.getElementById('nlSubject').value = '';
      document.getElementById('nlText').value    = '';
    }
  } catch (err) {
    showToast(err.message || 'Failed to send newsletter.', 'error');
  } finally {
    sendBtn.disabled  = false;
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polygon points="22,2 15,22 11,13 2,9" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg> Send to All Subscribers`;
  }
});

/* ── Unsubscribe modal ───────────────────────── */
function openUnsubModal(email) {
  unsubTarget = email;
  document.getElementById('unsubEmail').textContent = email;
  document.getElementById('unsubModal').style.display = 'flex';
}
document.getElementById('cancelUnsub').addEventListener('click', () => {
  document.getElementById('unsubModal').style.display = 'none';
  unsubTarget = null;
});
document.getElementById('unsubModal').addEventListener('click', e => {
  if (e.target === document.getElementById('unsubModal')) {
    document.getElementById('unsubModal').style.display = 'none';
    unsubTarget = null;
  }
});
document.getElementById('confirmUnsub').addEventListener('click', async () => {
  if (!unsubTarget) return;
  try {
    const res = await fetch(`${API}/newsletter/unsubscribe`, {
      method:  'DELETE',
      headers: jsonH(),
      body:    JSON.stringify({ email: unsubTarget }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Subscriber removed.', 'success');
    document.getElementById('unsubModal').style.display = 'none';
    unsubTarget = null;
    await loadSubscribers();
  } catch (err) {
    showToast(err.message || 'Failed to remove subscriber.', 'error');
  }
});

/* ── Toast ───────────────────────────────────── */
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3800);
}

loadSubscribers();
