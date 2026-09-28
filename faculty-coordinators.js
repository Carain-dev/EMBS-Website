(function () {
  'use strict';

  /* Fetches published Faculty Coordinators from the Members API
     (?faculty=true returns only isFacultyCoordinator:true + active:true members)
     and renders them into the Home page Faculty Coordinators section.

     Card structure preserved from original HTML:
       .fac-card > .fac-avatar + h3.fac-name + span.fac-role              */

  var API_BASE = window.EMBS_API_BASE;

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) { return w[0]; })
      .join('')
      .toUpperCase() || '?';
  }

  function buildCard(coordinator) {
    var name        = coordinator.name || '';
    var designation = coordinator.role || '';
    var photo       = coordinator.photo || '';

    var avatarHtml = photo
      ? '<img src="' + photo + '" alt="' + name + '" '
        + 'style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" '
        + 'loading="lazy" />'
      : initials(name);

    var card = document.createElement('div');
    card.className = 'fac-card';
    card.innerHTML =
      '<div class="fac-avatar"' + (photo ? ' style="padding:0;overflow:hidden;"' : '') + '>'
        + avatarHtml
      + '</div>'
      + '<h3 class="fac-name">' + name + '</h3>'
      + '<span class="fac-role">' + designation + '</span>';
    return card;
  }

  async function init() {
    var grid = document.getElementById('facultyCoordinatorsGrid');
    if (!grid || !API_BASE) return;

    try {
      var res  = await fetch(API_BASE + '/members?faculty=true');
      var json = await res.json();
      var coordinators = Array.isArray(json && json.data) ? json.data
                       : Array.isArray(json) ? json : [];

      if (!coordinators.length) {
        grid.innerHTML =
          '<p style="color:rgba(200,210,230,0.4);font-size:0.85rem;'
          + 'text-align:center;padding:1.5rem 0;width:100%;">'
          + 'No faculty coordinators added yet.</p>';
        return;
      }

      grid.innerHTML = '';
      coordinators.forEach(function (c) {
        grid.appendChild(buildCard(c));
      });

    } catch (err) {
      console.warn('faculty-coordinators: could not load coordinators —', err.message);
      /* API failure — show empty state instead of broken content */
      grid.innerHTML =
        '<p style="color:rgba(200,210,230,0.4);font-size:0.85rem;'
        + 'text-align:center;padding:1.5rem 0;width:100%;">'
        + 'No faculty coordinators added yet.</p>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
