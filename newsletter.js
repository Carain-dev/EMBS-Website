(function () {
  const API_BASE = window.EMBS_API_BASE;

  /* Three different newsletter forms ship across the site, each with its own
     class names. Only the footer one was ever wired, so the podcast subscribe
     box and the announcements signup sat behind onsubmit="return false" and
     silently did nothing. */
  const FORM_SELECTOR = [
    '.footer-newsletter-form',
    '.pod-subscribe-form',
    '.ann-newsletter-form',
  ].join(', ');

  function fieldsOf(form) {
    const input = form.querySelector('input[type="email"], input[type="text"]');
    const btn = form.querySelector('button[type="submit"], button, input[type="submit"]');
    return { input, btn };
  }

  async function handleSubscribe(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const { input, btn } = fieldsOf(form);
    if (!input || !btn) return;

    const email = input.value.trim();
    if (!email) {
      input.focus();
      return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Subscribing…';

    try {
      const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.status === 409) {
        btn.textContent = 'Already subscribed';
      } else if (!res.ok) {
        btn.textContent = 'Failed. Try again';
      } else {
        input.value = '';
        btn.textContent = 'Subscribed ✓';
      }
    } catch {
      btn.textContent = 'Failed. Try again';
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = original;
      }, 3000);
    }
  }

  function init() {
    document.querySelectorAll(FORM_SELECTOR).forEach((form) => {
      if (form.dataset.newsletterWired) return;
      form.dataset.newsletterWired = '1';

      /* These forms carry onsubmit="return false" in the markup, which cancels
         the event before any listener could act. Clearing it lets the handler
         below take over. */
      form.removeAttribute('onsubmit');
      form.onsubmit = null;

      form.addEventListener('submit', handleSubscribe);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
