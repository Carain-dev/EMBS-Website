import { apiGet } from './api.js';

(function () {
  'use strict';

  const DATE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const STOP_WORDS = new Set(['in', 'and', 'of', 'the', 'for', 'a', 'an']);

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(w => w && !STOP_WORDS.has(w))
      .join('-');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* The API populates `author` as a User document, so rendering it directly
     produced the literal text "By [object Object]" on every card. */
  function authorName(post) {
    if (post.author && typeof post.author === 'object') return post.author.name || '';
    if (typeof post.author === 'string') return post.author;
    return '';
  }

  /* The schema has no readTime field, so derive one. 200 wpm is the usual
     figure for online reading. */
  function readingMinutes(content) {
    const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 200)) : 0;
  }

  /* Categories are stored in `tags` by the admin panel. */
  function categoryOf(post) {
    if (post.category) return post.category;
    return Array.isArray(post.tags) && post.tags.length ? post.tags[0] : '';
  }

  function buildCard(post) {
    const category = categoryOf(post);
    const author = authorName(post) || 'IEEE EMBS Editorial Team';
    const minutes = readingMinutes(post.content);
    const excerpt = post.excerpt || String(post.content || '').slice(0, 160);
    const href = `post.html?id=${encodeURIComponent(post._id)}`;

    const article = document.createElement('article');
    article.className = 'blog-card';
    article.setAttribute('data-category', slugify(category));

    article.innerHTML = `
      <div class="blog-card-img-wrap">
        <a href="${href}" tabindex="-1" aria-hidden="true">
          <img src="${esc(post.thumbnail || post.coverImage || 'bg-image-embs/bluebg.jpeg')}" alt="" class="blog-card-img" loading="lazy" />
        </a>
        ${category ? `<span class="blog-card-cat">${esc(category)}</span>` : ''}
      </div>
      <div class="blog-card-body">
        <div class="blog-card-meta-top">
          <span class="blog-card-date">${DATE_SVG} ${esc(formatDate(post.publishedAt || post.createdAt))}</span>
          ${minutes ? `<span class="blog-card-read">${minutes} min read</span>` : ''}
        </div>
        <h3 class="blog-card-title"><a href="${href}">${esc(post.title)}</a></h3>
        <p class="blog-card-desc">${esc(excerpt)}${excerpt.length >= 160 ? '&hellip;' : ''}</p>
        <div class="blog-card-footer">
          <span class="blog-card-author">By ${esc(author)}</span>
          <a href="${href}" class="blog-btn">Read Article &rarr;</a>
        </div>
      </div>`;

    return article;
  }

  /* ── Filter chips ── */
  function initFilters(cards) {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', function () {
        chips.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');

        const filter = slugify(chip.getAttribute('data-filter'));
        let shown = 0;

        cards.forEach(card => {
          const match = filter === 'all' || card.getAttribute('data-category') === filter;
          card.style.display = match ? '' : 'none';
          if (match) shown++;
        });

        const none = document.getElementById('blogNoMatch');
        if (none) none.hidden = shown > 0;
      });
    });
  }

  /* ── Back to Top ── */
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ── Init ── */
  async function init() {
    const grid = document.getElementById('articlesGrid');
    if (!grid) return;

    grid.innerHTML = `<p class="embs-empty">Loading articles&hellip;</p>`;

    try {
      const res = await apiGet('/blogs');
      const posts = (res.data || res).filter(p => p.published !== false);

      if (!posts.length) {
        grid.innerHTML = `<p class="embs-empty">No articles have been published yet. Check back soon.</p>`;
        return;
      }

      grid.innerHTML = '';
      const cards = posts.map(post => {
        const card = buildCard(post);
        grid.appendChild(card);
        return card;
      });

      const none = document.createElement('p');
      none.className = 'embs-empty';
      none.id = 'blogNoMatch';
      none.hidden = true;
      none.textContent = 'No articles in this category yet.';
      grid.appendChild(none);

      initFilters(cards);
    } catch (err) {
      console.error('Failed to load blog posts:', err);
      grid.innerHTML = `<p class="embs-empty">Could not load articles. Please try again later.</p>`;
    }
  }

  init();

})();
