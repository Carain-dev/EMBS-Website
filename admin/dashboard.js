'use strict';

/* ── Auth Guard ── */
if (localStorage.getItem('embs_admin_auth') !== 'true') {
  window.location.href = 'index.html';
}

const API   = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ Authorization: `Bearer ${TOKEN()}` });

/* ── Quick Actions ── */
document.querySelectorAll('.qa-btn').forEach((btn, i) => {
  const pages = ['events.html', 'achievements.html', 'blog.html', 'podcast.html'];
  btn.addEventListener('click', () => location.href = pages[i]);
});

/* ── Sidebar toggle ── */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');

function openSidebar()  { sidebar.classList.add('open');    overlay.classList.add('active'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }

toggle.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
overlay.addEventListener('click', closeSidebar);
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
});

/* ── Date display ── */
const dateEl = document.getElementById('dashDate');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/* ── Relative time helper ── */
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1)  return 'Just now';
  if (mins  < 60)  return `${mins} min ago`;
  if (hours < 24)  return `${hours} hr ago`;
  if (days  <  2)  return 'Yesterday';
  if (days  <  7)  return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ── Set element text safely ── */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ── Build the Chart (called with real data) ── */
let chartInstance = null;

function buildChart(monthly, year) {
  const ctx = document.getElementById('eventsChart');
  if (!ctx) return;

  // Update subtitle with real year
  const subtitle = document.querySelector('.chart-panel .panel-subtitle');
  if (subtitle) subtitle.textContent = `Jan – Dec ${year}`;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const gradientBar = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
  gradientBar.addColorStop(0, '#6B2D8B');
  gradientBar.addColorStop(1, '#00A99D');

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Events',
        data: monthly,
        backgroundColor: gradientBar,
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.55,
        categoryPercentage: 0.7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(13,10,31,0.92)',
          borderColor: 'rgba(107,45,139,0.4)',
          borderWidth: 1,
          titleColor: '#e8eaf6',
          bodyColor: 'rgba(200,210,230,0.7)',
          titleFont: { family: "'Syne', sans-serif", size: 12, weight: '700' },
          bodyFont:  { family: "'DM Sans', sans-serif", size: 11 },
          padding: 10,
          callbacks: { label: c => ` ${c.parsed.y} event${c.parsed.y !== 1 ? 's' : ''}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: 'rgba(200,210,230,0.4)', font: { family: "'DM Sans', sans-serif", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(107,45,139,0.1)', drawBorder: false },
          border: { display: false, dash: [4, 4] },
          ticks: {
            color: 'rgba(200,210,230,0.4)',
            font: { family: "'DM Sans', sans-serif", size: 11 },
            stepSize: 1,
            maxTicksLimit: 6,
          },
        },
      },
    },
  });
}

/* ── Render activity list ── */
function renderActivity(activities) {
  const list = document.getElementById('activityList');
  if (!list) return;

  if (!activities || !activities.length) {
    list.innerHTML = '<li class="activity-item"><div class="activity-body">' +
      '<span class="activity-text" style="color:rgba(200,210,230,0.4);font-size:0.82rem;">No recent activity.</span>' +
      '</div></li>';
    return;
  }

  list.innerHTML = activities.map(item => `
    <li class="activity-item">
      <div class="activity-dot activity-dot--${item.color || 'teal'}"></div>
      <div class="activity-body">
        <span class="activity-text">${item.text}</span>
        <span class="activity-time">${relativeTime(item.ts)}</span>
      </div>
    </li>`).join('');
}

/* ── Fetch & populate everything ── */
async function loadDashboard() {
  try {
    const res  = await fetch(`${API}/dashboard/stats`, { headers: authH() });
    const json = await res.json();

    if (!res.ok || !json.data) {
      // Show zeros rather than fake values on error
      setText('statMembers',      '0');
      setText('statMembersDelta',  'Could not load');
      setText('statEvents',        '0');
      setText('statEventsDelta',   'Could not load');
      setText('statPending',       '0');
      setText('statPendingDelta',  'Could not load');
      setText('statPodcasts',      '0');
      setText('statPodcastsDelta', 'Could not load');
      buildChart(Array(12).fill(0), new Date().getFullYear());
      renderActivity([]);
      return;
    }

    const { members, events, podcasts, pending, recentActivity } = json.data;

    /* Stat cards */
    setText('statMembers',      members.total);
    setText('statMembersDelta',
      members.thisMonth > 0 ? `↑ ${members.thisMonth} this month` : 'Current total');

    setText('statEvents',       events.total);
    setText('statEventsDelta',
      events.upcoming > 0 ? `↑ ${events.upcoming} upcoming` : 'Current total');

    setText('statPending',      pending.review);
    setText('statPendingDelta',
      pending.review > 0 ? '⚠ Unpublished items' : 'All content published');

    setText('statPodcasts',      podcasts.total);
    setText('statPodcastsDelta',
      podcasts.thisMonth > 0 ? `↑ ${podcasts.thisMonth} this month` : 'Current total');

    /* Chart */
    buildChart(events.monthly, events.year);

    /* Activity feed */
    renderActivity(recentActivity);

  } catch (err) {
    console.error('Dashboard load failed:', err.message);
    setText('statMembers',      '—');
    setText('statMembersDelta',  'API error');
    setText('statEvents',        '—');
    setText('statEventsDelta',   'API error');
    setText('statPending',       '—');
    setText('statPendingDelta',  'API error');
    setText('statPodcasts',      '—');
    setText('statPodcastsDelta', 'API error');
    buildChart(Array(12).fill(0), new Date().getFullYear());
    renderActivity([]);
  }
}

loadDashboard();
