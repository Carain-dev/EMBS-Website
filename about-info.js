(function () {
  'use strict';

  /* Fetches chapter information from the public SiteSettings API and
     populates the corresponding About page elements.

     Elements targeted (IDs added in about.html):
       #aboutChapterDesc   — main description paragraph
       #aboutVisionText    — Vision card text
       #aboutMissionText   — Mission card text
       #aboutEstYear       — established year badge

     If the API is unavailable or a field is empty, the existing
     hardcoded text remains — the page never breaks.               */

  var API_BASE = window.EMBS_API_BASE;

  function setText(id, value) {
    if (!value || typeof value !== 'string' || !value.trim()) return;
    var el = document.getElementById(id);
    if (el) el.textContent = value.trim();
  }

  async function init() {
    if (!API_BASE) return;

    try {
      var res  = await fetch(API_BASE + '/site-settings/public');
      var json = await res.json();
      var data = (json && json.data) ? json.data : null;
      if (!data) return;

      setText('aboutChapterDesc', data.chapterDescription);
      setText('aboutVisionText',  data.vision);
      setText('aboutMissionText', data.mission);
      setText('aboutEstYear',     data.establishedYear);

    } catch (err) {
      /* API failure: silently keep the existing DOM text. */
      console.warn('about-info: could not load chapter info —', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
