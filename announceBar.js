(function () {
  const API_BASE = window.EMBS_API_BASE;

  async function loadAnnouncements() {
    const track = document.querySelector('.announce-track');
    if (!track) return;

    try {
      const res = await fetch(`${API_BASE}/announcements`);
      const json = await res.json();
      const items = json.data || json;

      if (!Array.isArray(items) || !items.length) return;

      // Build ticker content duplicated for seamless loop
      const html = [...items, ...items]
        .map((a, i) =>
          `<span class="announce-item">${a.title}</span>${i < items.length * 2 - 1 ? '<span class="announce-sep">&#8212;</span>' : ''}`
        )
        .join('');

      track.innerHTML = html;
    } catch {
      // Keep hardcoded fallback content on error
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAnnouncements);
  } else {
    loadAnnouncements();
  }
})();
