import { apiGet } from './api.js';

(function () {
  'use strict';

  /* Content is admin-authored, but it still goes through innerHTML — escape it
     so a stray angle bracket in a title cannot break (or rewrite) the card. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* The filter chips use slugs like "ai-healthcare" for "AI in Healthcare",
     so a plain space-to-dash swap does not line up. Dropping these short
     connecting words makes both sides normalise to the same string. */
  const STOP_WORDS = new Set(['in', 'and', 'of', 'the', 'for', 'a', 'an']);

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(word => word && !STOP_WORDS.has(word))
      .join('-');
  }

  /* Older records were saved by the admin panel with the category in tags[0]. */
  function categoryOf(project) {
    if (project.category) return project.category;
    return Array.isArray(project.tags) && project.tags.length ? project.tags[0] : '';
  }

  function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'proj-card-status--completed';
    if (s === 'published') return 'proj-card-status--published';
    return 'proj-card-status--ongoing';
  }

  function buildCard(project) {
    const category = categoryOf(project);
    const tags = Array.isArray(project.tags) ? project.tags : [];
    const team = Array.isArray(project.teamMembers)
      ? project.teamMembers.join(', ')
      : (project.teamMembers || '');

    // The admin panel stores these as repoUrl / liveUrl / paperUrl.
    const repo  = project.repoUrl  || project.githubLink || '';
    const paper = project.paperUrl || project.paperLink  || project.liveUrl || '';

    const links = [];
    if (repo)  links.push(`<a href="${esc(repo)}"  target="_blank" rel="noopener" class="proj-btn" style="margin-right:0.5rem;">GitHub</a>`);
    if (paper) links.push(`<a href="${esc(paper)}" target="_blank" rel="noopener" class="proj-btn">Paper</a>`);
    links.push(`<a href="project.html?id=${encodeURIComponent(project._id)}" class="proj-btn">View Details &rarr;</a>`);

    const article = document.createElement('article');
    article.className = 'proj-card';
    article.setAttribute('data-category', slugify(category));

    article.innerHTML = `
      <div class="proj-card-img-wrap">
        <img src="${esc(project.thumbnail || 'bg-image-embs/bluebg.jpeg')}" alt="${esc(project.title)}" class="proj-card-img" loading="lazy" />
        ${project.status ? `<span class="proj-card-status ${getStatusClass(project.status)}">${esc(project.status)}</span>` : ''}
        ${category ? `<span class="proj-card-category">${esc(category)}</span>` : ''}
      </div>
      <div class="proj-card-body">
        <h3 class="proj-card-title">${esc(project.title)}</h3>
        <p class="proj-card-desc">${esc(project.description)}</p>
        <div class="proj-card-meta">
          ${project.mentor ? `<div class="proj-card-meta-row"><span class="proj-meta-label">Mentor</span><span class="proj-meta-value">${esc(project.mentor)}</span></div>` : ''}
          ${team ? `<div class="proj-card-meta-row"><span class="proj-meta-label">Team</span><span class="proj-meta-value">${esc(team)}</span></div>` : ''}
        </div>
        ${tags.length ? `<div class="proj-card-tags">${tags.map(t => `<span class="proj-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="proj-card-footer">${links.join('')}</div>
      </div>`;

    return article;
  }

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

        const none = document.getElementById('projectsNoMatch');
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

  function message(grid, text) {
    grid.innerHTML = `<p class="embs-empty">${esc(text)}</p>`;
  }

  async function init() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    message(grid, 'Loading projects…');

    try {
      const res = await apiGet('/projects');
      const projects = (res.data || res).filter(p => p.visibility !== 'hidden');

      if (!projects.length) {
        message(grid, 'No projects have been published yet. Check back soon.');
        return;
      }

      grid.innerHTML = '';
      const cards = projects.map(project => {
        const card = buildCard(project);
        grid.appendChild(card);
        return card;
      });

      const none = document.createElement('p');
      none.className = 'embs-empty';
      none.id = 'projectsNoMatch';
      none.hidden = true;
      none.textContent = 'No projects in this category yet.';
      grid.appendChild(none);

      initFilters(cards);
    } catch (err) {
      console.error('Failed to load projects:', err);
      message(grid, 'Could not load projects. Please try again later.');
    }
  }

  init();

})();
