(function () {
  'use strict';

  /* Fetches GET /api/documents/public and finds the first document whose
     category matches "Brochure" (case-insensitive).

     Behaviour:
       - Brochure found     → show #brochureBtn with correct href, hide #brochureSoon
       - No brochure found  → hide #brochureBtn, show #brochureSoon
       - API error          → silently hide both (no broken UI, rest of page intact)

     Identification: uses the existing Document.category field.
     Admin sets category = "Brochure" when uploading the document.        */

  var API_BASE = window.EMBS_API_BASE;

  async function init() {
    var btn  = document.getElementById('brochureBtn');
    var soon = document.getElementById('brochureSoon');
    if (!btn || !API_BASE) return;

    try {
      var res  = await fetch(API_BASE + '/documents/public');
      var json = await res.json();
      var docs = Array.isArray(json && json.data) ? json.data
               : Array.isArray(json) ? json : [];

      /* Find the first published+public document categorised as "Brochure". */
      var brochure = docs.find(function (d) {
        return d && d.category &&
               d.category.trim().toLowerCase() === 'brochure' &&
               d.fileUrl;
      });

      if (brochure) {
        btn.href          = brochure.fileUrl;

        /* Build a meaningful download filename.
           Priority: originalFilename (the real uploaded name) →
                     title (admin-set) →
                     hard fallback. */
        var rawName = brochure.originalFilename || brochure.title || '';
        /* Strip any path prefix Cloudinary might have injected */
        rawName = rawName.replace(/.*\//, '').trim();
        /* Ensure the filename ends with .pdf (or preserves a real extension) */
        var downloadName;
        if (rawName && /\.[a-zA-Z0-9]+$/.test(rawName)) {
          /* Already has an extension */
          downloadName = rawName;
        } else if (rawName) {
          /* Has a name but no extension — append .pdf */
          downloadName = rawName + '.pdf';
        } else {
          downloadName = 'IEEE_EMBS_KPRIET_Brochure.pdf';
        }
        btn.setAttribute('download', downloadName);

        btn.style.display = '';          /* visible */
        if (soon) soon.style.display = 'none';
      } else {
        btn.style.display = 'none';
        /* Only show "coming soon" if an admin has previously uploaded at least
           one document, indicating the CMS is in use but no brochure yet.
           If the document list is completely empty, stay silent. */
        if (soon) soon.style.display = docs.length > 0 ? '' : 'none';
      }

    } catch (err) {
      /* API failure: keep both hidden, do not surface an error to the user. */
      console.warn('about-brochure: could not load documents —', err.message);
      btn.style.display  = 'none';
      if (soon) soon.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
