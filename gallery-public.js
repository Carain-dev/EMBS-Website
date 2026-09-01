(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  function buildGridCard(item) {
    const article = document.createElement('article');
    article.className = 'gallery-grid-card';
    article.innerHTML = `
      <div class="gallery-grid-img-wrap" style="background:none;">
        <img src="${item.imageUrl}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" />
      </div>
      <p class="gallery-grid-title">${item.title}${item.caption ? ' — ' + item.caption : ''}</p>`;
    return article;
  }

  async function init() {
    const grid = document.querySelector('.gallery-grid-wrap');
    if (!grid) return;

    try {
      const res = await fetch(`${API_BASE}/gallery`);
      const json = await res.json();
      const items = json.data || json;

      if (!Array.isArray(items) || !items.length) return;

      grid.innerHTML = '';
      items.forEach(item => grid.appendChild(buildGridCard(item)));

      // Also update the featured large card with the first image
      const featImg = document.querySelector('.gallery-preview-img');
      const featPlaceholder = document.querySelector('.gallery-placeholder-view');
      if (featImg && items[0]) {
        featImg.src = items[0].imageUrl;
        featImg.style.display = 'block';
        if (featPlaceholder) featPlaceholder.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load gallery:', err);
    }
  }

  init();
})();
