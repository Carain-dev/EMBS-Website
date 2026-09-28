(function () {
  'use strict';

  /* Populates the "Our Impact" stat cards on activities.html.
     Events Conducted  → GET /api/events    (count of all published events)
     Research Projects → GET /api/projects  (count of published projects)
     Student Participants and Industry Collaborations have no database
     collection — their cards show a neutral label without a number.    */

  var API_BASE = window.EMBS_API_BASE;

  async function init() {
    var eventsEl   = document.getElementById('statEventsCount');
    var projectsEl = document.getElementById('statProjectsCount');
    if (!API_BASE) return;

    try {
      var [evRes, prRes] = await Promise.all([
        fetch(API_BASE + '/events'),
        fetch(API_BASE + '/projects'),
      ]);
      var evJson = await evRes.json();
      var prJson = await prRes.json();

      var evCount = Array.isArray(evJson.data)  ? evJson.data.length
                  : Array.isArray(evJson)        ? evJson.length : null;
      var prCount = Array.isArray(prJson.data)  ? prJson.data.length
                  : Array.isArray(prJson)        ? prJson.length : null;

      if (eventsEl   && evCount !== null) eventsEl.textContent   = evCount + '+';
      if (projectsEl && prCount !== null) projectsEl.textContent = prCount + '+';
    } catch (err) {
      console.warn('activities-stats: could not load stats —', err.message);
      /* On failure the neutral labels remain unchanged */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
