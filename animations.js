/* ================================================================
   animations.js — IEEE EMBS KPRIET
   Professional text reveal animation system.
   Vanilla JS + CSS only. No external libraries.

   EXPORTS (attached to window.EMBSAnim for optional external use):
     initHeroAnim(headingEl, subEl, ctaEl, options)
     initScrollReveal(selector, options)
     initStaggerReveal(containerSelector, childSelector, options)
     splitWords(el, baseDelayMs)

   DESIGN PRINCIPLES
   ──────────────────────────────────────────────────────────────
   • One IntersectionObserver per call, cleaned up after triggering
   • Respects prefers-reduced-motion at all entry points
   • Does not modify layout — word spans use inline-block
   • Does not break existing .mem-fade-in system on members.html
   • Does not touch gallery.css gal-reveal classes
   • Safe to call on DOMContentLoaded or after dynamic content loads
   ================================================================ */

(function (global) {
  'use strict';

  /* ── Reduced-motion check ──────────────────────────────────── */
  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /* ── IntersectionObserver availability ────────────────────── */
  var hasIO = typeof IntersectionObserver !== 'undefined';

  /* ── 1. WORD SPLIT ─────────────────────────────────────────── */
  /*  Splits an element's text content into individual word spans
      that can animate independently.

      Handles:
        - Plain text nodes
        - <br> tags (preserved as-is)
        - Existing child elements like <span class="heading-gradient">
          (their text content is also split but the span wrapper is kept)

      After splitting:
        el.innerHTML looks like:
          <span class="embs-word-line">
            <span class="embs-word" style="--embs-wi:N">Word</span>
          </span>
          ...

      Returns the total word count (used to calculate subtitle delay). */

  function splitWords(el, baseDelayMs) {
    if (!el || el.getAttribute('data-embs-split')) return 0;
    el.setAttribute('data-embs-split', '1');

    var base = baseDelayMs || 0;
    var wordIndex = 0;

    /* Walk child nodes, preserving non-text elements */
    var nodes = Array.prototype.slice.call(el.childNodes);
    var fragment = document.createDocumentFragment();

    nodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        /* Split text by spaces, emit a word-line+word for each */
        var words = node.textContent.split(/(\s+)/);
        words.forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) {
            /* Whitespace between words — preserve as text */
            fragment.appendChild(document.createTextNode(chunk));
            return;
          }
          /* One word */
          var wordSpan = document.createElement('span');
          wordSpan.className = 'embs-word';
          wordSpan.style.setProperty('--embs-wi', String(wordIndex));
          if (base) wordSpan.style.setProperty('--embs-base-delay', base + 'ms');
          wordSpan.textContent = chunk;
          fragment.appendChild(wordSpan);
          wordIndex++;
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') {
          /* Keep line breaks */
          fragment.appendChild(node.cloneNode(false));
        } else {
          /* Inline elements like <span class="heading-gradient">:
             Wrap the ENTIRE element as one .embs-word unit rather than
             splitting its inner text. Splitting inner text breaks CSS
             effects like -webkit-background-clip:text / gradient text
             because the inner .embs-word span has no background of its
             own, making the text permanently transparent. */
          var deepClone = node.cloneNode(true); /* full clone, keep inner HTML */
          deepClone.classList.add('embs-word');
          deepClone.style.setProperty('--embs-wi', String(wordIndex));
          if (base) deepClone.style.setProperty('--embs-base-delay', base + 'ms');
          fragment.appendChild(deepClone);
          wordIndex++;
        }
      }
    });

    /* Replace content */
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(fragment);

    return wordIndex;
  }

  /* ── 2. HERO ANIMATION ─────────────────────────────────────── */
  /*  Fires on page load (not scroll-triggered).
      heading → sub → cta appear in sequence.

      Options:
        baseDelay  {number}  ms before first word (default 80)
        subDelay   {number}  ms before subtitle   (default auto: word count * 75 + 100)
        ctaDelay   {number}  ms before cta         (default auto: subDelay + 200)
  */

  function initHeroAnim(headingEl, subEl, ctaEl, opts) {
    opts = opts || {};

    if (prefersReducedMotion()) {
      /* Show everything immediately — no visual hiding was applied to static HTML,
         but JS may have been called before classes are set, so explicitly ensure
         visible states if the CSS was already applied. */
      if (headingEl) headingEl.classList.add('embs-word-split--go');
      if (subEl)     subEl.classList.add('embs-hero-sub--go');
      if (ctaEl)     ctaEl.classList.add('embs-hero-cta--go');
      return;
    }

    var baseDelay = opts.baseDelay != null ? opts.baseDelay : 80;
    var wordCount = 0;

    if (headingEl) {
      wordCount = splitWords(headingEl, baseDelay);
      headingEl.classList.add('embs-word-split');

      /* Trigger on next frame so the browser paints the initial hidden state */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          headingEl.classList.add('embs-word-split--go');
        });
      });
    }

    /* Auto-calculate delays from word count */
    var autoSubDelay = wordCount * 70 + 120;
    var subDelay  = opts.subDelay  != null ? opts.subDelay  : autoSubDelay;
    var ctaDelay  = opts.ctaDelay  != null ? opts.ctaDelay  : subDelay + 200;

    if (subEl) {
      subEl.classList.add('embs-hero-sub');
      subEl.style.setProperty('--embs-sub-delay', subDelay + 'ms');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          subEl.classList.add('embs-hero-sub--go');
        });
      });
    }

    if (ctaEl) {
      ctaEl.classList.add('embs-hero-cta');
      ctaEl.style.setProperty('--embs-cta-delay', ctaDelay + 'ms');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ctaEl.classList.add('embs-hero-cta--go');
        });
      });
    }
  }

  /* ── 3. SCROLL REVEAL ──────────────────────────────────────── */
  /*  Watches elements matching `selector` and adds .embs-in when
      they enter the viewport.

      Options:
        threshold   {number}   default 0.1
        rootMargin  {string}   default '0px 0px -40px 0px'
        once        {boolean}  default true — unobserve after first trigger
  */

  function initScrollReveal(selector, opts) {
    if (prefersReducedMotion()) {
      /* Make all matching elements visible immediately */
      document.querySelectorAll(selector).forEach(function (el) {
        el.classList.add('embs-in');
      });
      return;
    }

    opts = opts || {};
    var threshold  = opts.threshold  != null ? opts.threshold  : 0.1;
    var rootMargin = opts.rootMargin || '0px 0px -40px 0px';
    var once       = opts.once !== false;

    if (!hasIO) {
      document.querySelectorAll(selector).forEach(function (el) {
        el.classList.add('embs-in');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('embs-in');
        if (once) observer.unobserve(entry.target);
      });
    }, { threshold: threshold, rootMargin: rootMargin });

    document.querySelectorAll(selector).forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── 4. STAGGER REVEAL ─────────────────────────────────────── */
  /*  Like initScrollReveal but assigns --embs-stagger-i CSS vars
      so CSS can stagger the transition-delay automatically.

      Observes the container; when it enters the viewport all direct
      matching children get their index set and .embs-in added with
      a per-item rAF to ensure paint separation.

      Options:
        childSelector  {string}  CSS selector for children (default '.embs-reveal')
        threshold      {number}  default 0.05
        rootMargin     {string}  default '0px 0px -30px 0px'
        maxStagger     {number}  max items to stagger before cap (default 6)
  */

  function initStaggerReveal(containerSelector, childSelector, opts) {
    if (prefersReducedMotion()) {
      document.querySelectorAll(containerSelector).forEach(function (container) {
        container.querySelectorAll(childSelector || '.embs-reveal').forEach(function (child) {
          child.style.setProperty('--embs-stagger-i', '0');
          child.classList.add('embs-in');
        });
      });
      return;
    }

    opts = opts || {};
    var cSel       = childSelector || '.embs-reveal';
    var threshold  = opts.threshold  != null ? opts.threshold  : 0.05;
    var rootMargin = opts.rootMargin || '0px 0px -30px 0px';
    var maxStagger = opts.maxStagger != null ? opts.maxStagger : 6;

    if (!hasIO) {
      document.querySelectorAll(containerSelector).forEach(function (container) {
        container.querySelectorAll(cSel).forEach(function (child, i) {
          child.style.setProperty('--embs-stagger-i', String(Math.min(i, maxStagger)));
          child.classList.add('embs-in');
        });
      });
      return;
    }

    document.querySelectorAll(containerSelector).forEach(function (container) {
      var children = container.querySelectorAll(cSel);
      /* Assign stagger indices up-front */
      children.forEach(function (child, i) {
        child.style.setProperty('--embs-stagger-i', String(Math.min(i, maxStagger)));
      });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          /* Trigger each child in a separate rAF to let the browser breathe */
          entry.target.querySelectorAll(cSel).forEach(function (child) {
            child.classList.add('embs-in');
          });
          observer.unobserve(entry.target);
        });
      }, { threshold: threshold, rootMargin: rootMargin });

      observer.observe(container);
    });
  }

  /* ── 5. SECTION HEADING REVEAL ─────────────────────────────── */
  /*  Pairs a label + heading + optional description.
      Label fades first, heading follows 90ms later, desc after that. */

  function initSectionHeadingReveal(labelSelector, headingSelector, descSelector) {
    if (prefersReducedMotion()) {
      [labelSelector, headingSelector, descSelector].forEach(function (sel) {
        if (sel) document.querySelectorAll(sel).forEach(function (el) {
          el.classList.add('embs-in');
        });
      });
      return;
    }

    if (!hasIO) {
      [labelSelector, headingSelector, descSelector].forEach(function (sel) {
        if (sel) document.querySelectorAll(sel).forEach(function (el) {
          el.classList.add('embs-in');
        });
      });
      return;
    }

    /* Observe headings; when in view, also trigger nearby label/desc */
    document.querySelectorAll(headingSelector).forEach(function (heading) {
      var parent = heading.closest('div, section, header') || heading.parentElement;

      var label = labelSelector && parent ? parent.querySelector(labelSelector) : null;
      var desc  = descSelector  && parent ? parent.querySelector(descSelector)  : null;

      /* Pre-class items that aren't already classed */
      if (label && !label.classList.contains('embs-section-label')) {
        label.classList.add('embs-section-label');
      }
      if (!heading.classList.contains('embs-reveal')) {
        heading.classList.add('embs-reveal', 'embs-reveal--heading');
      }
      if (desc && !desc.classList.contains('embs-reveal')) {
        desc.classList.add('embs-reveal', 'embs-reveal--soft');
        desc.style.setProperty('--embs-stagger-i', '2');
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (label)   label.classList.add('embs-in');
          heading.classList.add('embs-in');
          if (desc)    desc.classList.add('embs-in');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

      observer.observe(heading);
    });
  }

  /* ── 6. PAGE INITIALISATION ────────────────────────────────── */
  /*  Each page calls EMBS.init(config).
      config is an object describing what to animate on that page.

      config = {
        // Hero section
        hero: {
          heading:    '.hero-heading',    // CSS selector or element
          sub:        '.hero-sub',
          cta:        '.hero-buttons',
          baseDelay:  80,                 // optional
        },
        // Section headings — array of { label, heading, desc }
        sections: [
          { label: '.activities-label', heading: '.activities-title' },
          ...
        ],
        // Stagger grids — array of { container, child }
        stagger: [
          { container: '.activities-grid', child: '.act-card' },
          ...
        ],
        // Simple scroll reveals (single selector)
        reveal: ['.stat-item', '.wj-card'],
      }
  */

  function init(config) {
    if (!config) return;

    /* Hero */
    if (config.hero) {
      var h = config.hero;
      var headingEl = typeof h.heading === 'string'
        ? document.querySelector(h.heading) : h.heading;
      var subEl = typeof h.sub === 'string'
        ? document.querySelector(h.sub) : h.sub;
      var ctaEl = typeof h.cta === 'string'
        ? document.querySelector(h.cta) : h.cta;
      initHeroAnim(headingEl, subEl, ctaEl, h);
    }

    /* Section headings */
    if (Array.isArray(config.sections)) {
      config.sections.forEach(function (s) {
        initSectionHeadingReveal(s.label || null, s.heading, s.desc || null);
      });
    }

    /* Stagger grids */
    if (Array.isArray(config.stagger)) {
      config.stagger.forEach(function (s) {
        /* Add embs-reveal to children if not already present */
        document.querySelectorAll(s.container).forEach(function (container) {
          container.querySelectorAll(s.child).forEach(function (child) {
            if (!child.classList.contains('embs-reveal')) {
              child.classList.add('embs-reveal');
            }
          });
        });
        initStaggerReveal(s.container, s.child, s.opts);
      });
    }

    /* Simple reveal */
    if (Array.isArray(config.reveal)) {
      config.reveal.forEach(function (sel) {
        /* Add class if not already present */
        document.querySelectorAll(sel).forEach(function (el) {
          if (!el.classList.contains('embs-reveal')) {
            el.classList.add('embs-reveal');
          }
        });
        initScrollReveal(sel);
      });
    }
  }

  /* ── 7. ALSO WIRE .mem-fade-in (members.html compat) ────────── */
  /*  members.html already has an inline IntersectionObserver for
      .mem-fade-in. We don't replace it — this is a no-op if that
      inline script already ran. We only run this if the class
      exists on the page and the inline observer hasn't fired yet
      (detectable by .visible not being present). */

  function initMemFadeInCompat() {
    var elements = document.querySelectorAll('.mem-fade-in:not(.visible)');
    if (!elements.length) return;

    if (prefersReducedMotion()) {
      elements.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    if (!hasIO) {
      elements.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    elements.forEach(function (el) { obs.observe(el); });
  }

  /* ── 8. AUTO-RUN ───────────────────────────────────────────── */
  /*  Page-specific configs are defined inline in each HTML file
      as window.EMBS_ANIM_CONFIG before animations.js loads.
      animations.js reads it and calls init() on DOMContentLoaded. */

  function boot() {
    initMemFadeInCompat();
    if (global.EMBS_ANIM_CONFIG) {
      init(global.EMBS_ANIM_CONFIG);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Public API ────────────────────────────────────────────── */
  global.EMBSAnim = {
    init:                     init,
    initHeroAnim:             initHeroAnim,
    initScrollReveal:         initScrollReveal,
    initStaggerReveal:        initStaggerReveal,
    initSectionHeadingReveal: initSectionHeadingReveal,
    splitWords:               splitWords,
  };

}(window));
