import { apiGet } from './api.js';

(function () {
  'use strict';

  const mount = document.getElementById('projectDetail');
  if (!mount) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Only allow links the page will actually navigate to, so a stored
     "javascript:" value cannot become a clickable script trigger. */
  function safeUrl(value) {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function state(title, detail, showBack) {
    mount.innerHTML = `
      <div class="pd-state">
        <p class="pd-state-title">${esc(title)}</p>
        <p>${esc(detail)}</p>
        ${showBack ? '<p style="margin-top:1.5rem"><a class="pd-btn" href="projects.html">Browse all projects</a></p>' : ''}
      </div>`;
  }

  function categoryOf(project) {
    if (project.category) return project.category;
    return Array.isArray(project.tags) && project.tags.length ? project.tags[0] : '';
  }

  function teamOf(project) {
    if (Array.isArray(project.teamMembers) && project.teamMembers.length) {
      return project.teamMembers.join(', ');
    }
    // `members` is a populated list of Member documents.
    if (Array.isArray(project.members) && project.members.length) {
      return project.members.map(m => (m && m.name) ? m.name : '').filter(Boolean).join(', ');
    }
    return '';
  }

  function render(project) {
    const category = categoryOf(project);
    const team = teamOf(project);
    const tags = Array.isArray(project.tags) ? project.tags : [];

    const repo  = safeUrl(project.repoUrl  || project.githubLink);
    const paper = safeUrl(project.paperUrl || project.paperLink);
    const live  = safeUrl(project.liveUrl);

    const created = project.createdAt
      ? new Date(project.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
      : '';

    const facts = [
      project.mentor && { label: 'Mentor', value: project.mentor },
      team && { label: 'Team', value: team },
      created && { label: 'Published', value: created },
    ].filter(Boolean);

    document.title = `${project.title} – Projects – IEEE EMBS`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && project.description) {
      desc.setAttribute('content', String(project.description).slice(0, 155));
    }

    mount.innerHTML = `
      <article>
        <div class="pd-meta-row">
          ${category ? `<span class="pd-chip">${esc(category)}</span>` : ''}
          ${project.status ? `<span class="pd-chip pd-chip--status">${esc(project.status)}</span>` : ''}
        </div>

        <h1 class="pd-title">${esc(project.title)}</h1>

        ${project.thumbnail
          ? `<img class="pd-hero-img" src="${esc(project.thumbnail)}" alt="${esc(project.title)}" />`
          : ''}

        ${project.description ? `
          <h2 class="pd-section-title">About this project</h2>
          <p class="pd-desc">${esc(project.description)}</p>` : ''}

        ${facts.length ? `
          <div class="pd-facts">
            ${facts.map(f => `
              <div class="pd-fact">
                <span class="pd-fact-label">${esc(f.label)}</span>
                <span class="pd-fact-value">${esc(f.value)}</span>
              </div>`).join('')}
          </div>` : ''}

        ${tags.length ? `
          <h2 class="pd-section-title">Tags</h2>
          <div class="pd-tags">${tags.map(t => `<span class="pd-tag">${esc(t)}</span>`).join('')}</div>` : ''}

        ${(repo || paper || live) ? `
          <div class="pd-actions">
            ${repo  ? `<a class="pd-btn" href="${esc(repo)}"  target="_blank" rel="noopener">View Repository</a>` : ''}
            ${paper ? `<a class="pd-btn pd-btn--ghost" href="${esc(paper)}" target="_blank" rel="noopener">Read Paper</a>` : ''}
            ${live  ? `<a class="pd-btn pd-btn--ghost" href="${esc(live)}"  target="_blank" rel="noopener">Live Demo</a>` : ''}
          </div>` : ''}
      </article>`;
  }

  async function init() {
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
      state('No project selected', 'Pick a project from the projects page to see its details.', true);
      return;
    }

    state('Loading…', 'Fetching project details.', false);

    try {
      const res = await apiGet(`/projects/${encodeURIComponent(id)}`);
      const project = res.data || res;

      if (!project || !project._id) {
        state('Project not found', 'This project may have been removed.', true);
        return;
      }

      render(project);
    } catch (err) {
      console.error('Failed to load project:', err);
      const notFound = /not found|404|invalid/i.test(err.message || '');
      state(
        notFound ? 'Project not found' : 'Could not load this project',
        notFound
          ? 'This project may have been removed.'
          : 'Please check your connection and try again.',
        true
      );
    }
  }

  /* ── Back to Top ── */
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  init();

})();
