(function () {
  const API_BASE = window.EMBS_API_BASE;

  const form    = document.querySelector('.contact-form');
  const btn     = form && form.querySelector('.contact-submit');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name    = form.querySelector('#contactName').value.trim();
    const email   = form.querySelector('#contactEmail').value.trim();
    const subject = form.querySelector('#contactSubject').value.trim();
    const message = form.querySelector('#contactMessage').value.trim();

    if (!name || !email || !subject || !message) {
      showStatus('Please fill in all fields.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const json = await res.json();

      if (!res.ok) {
        showStatus(json.message || 'Failed to send. Try again.', 'error');
      } else {
        form.reset();
        showStatus('Message sent successfully! We will get back to you soon.', 'success');
      }
    } catch {
      showStatus('Could not reach the server. Please try again later.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message →';
    }
  });

  function showStatus(msg, type) {
    let el = form.querySelector('.contact-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'contact-status';
      el.style.cssText = 'margin-top:12px; font-size:14px; font-weight:500;';
      btn.insertAdjacentElement('afterend', el);
    }
    el.textContent = msg;
    el.style.color = type === 'success' ? '#00A99D' : '#e05555';
    setTimeout(() => { el.textContent = ''; }, 5000);
  }
})();
