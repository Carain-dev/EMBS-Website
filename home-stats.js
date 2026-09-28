(function () {
  'use strict';

  /* Populates the four hero stat numbers on the Home page.
     Each uses an existing public API — no new endpoints needed.

     Members    → GET /api/members          (count of active members)
     Activities → GET /api/events           (count of published events)
     Projects   → GET /api/projects         (count of featured+visible projects)
     Awards     → GET /api/achievements     (count of featured achievements)

     On API failure the span keeps "—" (set in HTML) — no fake fallback number. */

  var API_BASE = window.EMBS_API_BASE;

  function setCount(id, items) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = Array.isArray(items) ? items.length : 0;
    el.textContent = n > 0 ? n + '+' : String(n);
  }

  async function init() {
    if (!API_BASE) return;

    try {
      var results = await Promise.allSettled([
        fetch(API_BASE + '/members'),
        fetch(API_BASE + '/events'),
        fetch(API_BASE + '/projects'),
        fetch(API_BASE + '/achievements'),
      ]);

      /* Members */
      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        var mj = await results[0].value.json();
        setCount('heroStatMembers', mj.data || mj);
      }

      /* Activities (events) */
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        var ej = await results[1].value.json();
        setCount('heroStatActivities', ej.data || ej);
      }

      /* Projects */
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        var pj = await results[2].value.json();
        setCount('heroStatProjects', pj.data || pj);
      }

      /* Awards (featured achievements) */
      if (results[3].status === 'fulfilled' && results[3].value.ok) {
        var aj = await results[3].value.json();
        setCount('heroStatAwards', aj.data || aj);
      }

    } catch (err) {
      /* Silent failure — "—" placeholders remain, no fake numbers shown */
      console.warn('home-stats: could not load stats —', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
