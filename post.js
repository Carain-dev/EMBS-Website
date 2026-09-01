import { apiGet } from './api.js';

(function () {
  'use strict';

  const mount = document.getElementById('postDetail');
  if (!mount) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function state(title, detail, showBack) {
    mount.innerHTML = `
      <div class="pd-state">
        <p class="pd-state-title">${esc(title)}</p>
        <p>${esc(detail)}</p>
        ${showBack ? '<p style="margin-top:1.5rem"><a class="pd-btn" href="blog.html">Browse all articles</a></p>' : ''}
      </div>`;
  }

  function authorName(post) {
    if (post.author && typeof post.author === 'object') return post.author.name || '';
    if (typeof post.author === 'string') return post.author;
    return '';
  }

  function readingMinutes(content) {
    const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 200)) : 0;
  }

  function categoryOf(post) {
    if (post.category) return post.category;
    return Array.isArray(post.tags) && post.tags.length ? post.tags[0] : '';
  }

  /* Content is stored as plain text with blank lines between paragraphs.
     Escape first, then split, so the markup we add is the only markup. */
  function paragraphs(content) {
    return String(content || '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  function render(post) {
    const category = categoryOf(post);
    const author = authorName(post) || 'IEEE EMBS Editorial Team';
    const minutes = readingMinutes(post.content);
    const date = post.publishedAt || post.createdAt;
    const dateText = date
      ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const tags = Array.isArray(post.tags) ? post.tags : [];

    document.title = `${post.title} – Blog – IEEE EMBS`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      const summary = post.excerpt || String(post.content || '').slice(0, 155);
      if (summary) desc.setAttribute('content', summary);
    }

    mount.innerHTML = `
      <article>
        <div class="pd-meta-row">
          ${category ? `<span class="pd-chip">${esc(category)}</span>` : ''}
          ${minutes ? `<span class="pd-chip pd-chip--status">${minutes} min read</span>` : ''}
        </div>

        <h1 class="pd-title">${esc(post.title)}</h1>

        <p class="post-byline">
          By <strong>${esc(author)}</strong>${dateText ? ` &middot; <time datetime="${esc(date)}">${esc(dateText)}</time>` : ''}
        </p>

        ${post.thumbnail ? `<img class="pd-hero-img" src="${esc(post.thumbnail)}" alt="" />` : ''}

        ${post.excerpt ? `<p class="post-lede">${esc(post.excerpt)}</p>` : ''}

        <div class="post-body">${paragraphs(post.content)}</div>

        ${tags.length ? `
          <h2 class="pd-section-title">Tags</h2>
          <div class="pd-tags">${tags.map(t => `<span class="pd-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </article>`;
  }

  async function init() {
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
      state('No article selected', 'Pick an article from the blog page to read it.', true);
      return;
    }

    state('Loading…', 'Fetching the article.', false);

    try {
      const res = await apiGet(`/blogs/${encodeURIComponent(id)}`);
      const post = res.data || res;

      if (!post || !post._id) {
        state('Article not found', 'This article may have been removed.', true);
        return;
      }

      render(post);
    } catch (err) {
      console.error('Failed to load article:', err);
      const notFound = /not found|404|invalid/i.test(err.message || '');
      state(
        notFound ? 'Article not found' : 'Could not load this article',
        notFound ? 'This article may have been removed.' : 'Please check your connection and try again.',
        true
      );
    }
  }

  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  init();

})();
