/* ================================================================
   events-experience.js — IEEE EMBS KPRIET (events.html only)

   Presentation layer for the Events page. events.js still owns the
   programme grid (fetch, search, filters, pagination); this script:
     • tags each card it renders as upcoming / past and adds a date
       column + "live" flag (decoration only — events.js never sees it)
     • renders, read-only from GET /api/events, the hero's live counts,
       the featured "ticket" and the month rhythm chart
   Motion: motion.js reveals the cards (watch) and new content;
   animations.js owns the headings. Nothing here animates by itself
   except a class toggle that lets CSS draw the rhythm chart.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) return;
  var esc = K.esc, q = K.q, qa = K.qa;

  var ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="13,6 19,12 13,18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function statusOf(ev) { return String(ev.status || '').toLowerCase(); }
  function isUpcoming(ev) { var s = statusOf(ev); return s === 'upcoming' || s === 'ongoing'; }
  function eventUrl(ev) { return 'event.html?id=' + encodeURIComponent(ev._id || ''); }

  function typeLabel(ev) {
    var t = K.plain(ev.type);
    return t && t.toLowerCase() !== 'other' ? t : '';
  }

  /* ── the programme grid (rendered by events.js) ──────────────── */

  function makeMark() {
    var m = doc.createElement('p');
    m.className = 'evx-archive-mark';
    m.setAttribute('aria-hidden', 'true');
    m.textContent = 'Archive';
    return m;
  }

  function tagGrid(grid) {
    var cards = qa('.ev-card', grid);
    if (!cards.length) return;
    var up = 0, past = 0;
    cards.forEach(function (card) {
      var tag = q('.ev-tag', card);
      var upcoming = !!(tag && /ev-tag--(upcoming|ongoing)/.test(tag.className));
      card.classList.toggle('is-upcoming', upcoming);
      card.classList.toggle('is-past', !upcoming);
      if (upcoming) up++; else past++;
      if (card._evx) return;
      card._evx = true;

      /* date column, from the card's own date text */
      var dateEl = q('.ev-date', card);
      var d = dateEl ? new Date(dateEl.textContent) : null;
      var dp = d && !isNaN(d) ? K.dateParts(d) : null;
      if (dp) {
        var t = doc.createElement('time');
        t.className = 'evx-day';
        t.setAttribute('datetime', dp.iso);
        t.setAttribute('aria-hidden', 'true');      /* the card already states its date */
        t.innerHTML = '<b>' + dp.day + '</b>' + dp.mon + ' ' + dp.year;
        card.insertBefore(t, card.firstChild);
      }

      /* the event type, read from the card's own label, joins the meta line */
      var type = q('.ev-card-type', card);
      var meta = q('.ev-meta', card);
      if (type && meta && K.plain(type.textContent) && K.plain(type.textContent).toLowerCase() !== 'other') {
        var s = doc.createElement('span');
        s.className = 'evx-type';
        s.textContent = K.plain(type.textContent);
        meta.insertBefore(s, meta.firstChild);
      }

      if (upcoming) {
        var top = q('.ev-card-top', card);
        if (top) {
          var flag = doc.createElement('span');
          flag.className = 'evx-flag';
          flag.innerHTML = '<span class="pg-live" aria-hidden="true"></span>' + esc(K.cap(tag.textContent) || 'Upcoming');
          top.appendChild(flag);
        }
      }
    });

    /* upcoming first, then the archive, each keeping events.js's order.
       Only touch the DOM when the order is wrong — moving nodes fires
       this observer again, so the step must be idempotent. */
    var ups = cards.filter(function (c) { return c.classList.contains('is-upcoming'); });
    var pasts = cards.filter(function (c) { return c.classList.contains('is-past'); });
    var mark = q('.evx-archive-mark', grid);
    var wanted = ups.concat(ups.length && pasts.length ? [mark || makeMark()] : [], pasts);
    var now = qa('.ev-card, .evx-archive-mark', grid);
    var same = wanted.length === now.length && wanted.every(function (el, k) { return now[k] === el; });
    if (!same) {
      var frag = doc.createDocumentFragment();
      wanted.forEach(function (el) { frag.appendChild(el); });
      if (mark && wanted.indexOf(mark) < 0) mark.remove();
      grid.insertBefore(frag, grid.firstChild);
    }
    grid.setAttribute('data-up', String(up));

    var key = doc.getElementById('evxProgKey');
    if (key) key.innerHTML = '<span><b>' + up + '</b>upcoming</span><span><b>' + past + '</b>on record</span>';
  }

  /* ── featured ticket ─────────────────────────────────────────── */

  function pickFeatured(evs) {
    var upcoming = evs.filter(isUpcoming).sort(function (a, b) { return (a._d || 0) - (b._d || 0); });
    var latest = evs.slice().sort(function (a, b) { return (b._d || 0) - (a._d || 0); });
    return upcoming.filter(function (e) { return e.featured; })[0] || upcoming[0] ||
           latest.filter(function (e) { return e.featured; })[0] || latest[0];
  }

  function whenLabel(ev) {
    if (!isUpcoming(ev)) return '';
    var n = K.daysUntil(ev._d);
    if (n === null || n < 0) return '';
    return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
  }

  function renderFeature(ev) {
    var dp = K.dateParts(ev._d);
    var reg = K.safeUrl(ev.registrationLink);
    var art = K.img(ev.thumbnail, 1000);
    var spec = [];
    if (typeLabel(ev)) spec.push(['Format', typeLabel(ev)]);
    if (ev.mode) spec.push(['Mode', K.cap(ev.mode)]);
    if (ev.venue) spec.push(['Venue', K.plain(ev.venue)]);
    if (ev.time) spec.push(['Time', K.plain(ev.time)]);
    if (ev.speaker) spec.push(['Speaker', K.plain(ev.speaker)]);
    var when = whenLabel(ev);
    var kicker = statusOf(ev) === 'ongoing' ? 'Happening now' : isUpcoming(ev) ? 'Next up' : 'Most recent';

    return '<div class="evx-feat-grid">' +
      '<div class="evx-cal">' +
        (dp ? '<time class="evx-cal-date" datetime="' + dp.iso + '"><span class="evx-cal-day">' + dp.day + '</span>' +
              '<span class="evx-cal-my"><b>' + dp.mon + '</b>' + dp.year + '</span></time>' : '') +
        (when ? '<span class="evx-cal-when"><span class="pg-live" aria-hidden="true"></span>' + esc(when) + '</span>' : '') +
        '<div><span class="evx-cal-kicker">' + esc(kicker) + '</span>' +
        '<h3 class="evx-feat-title"><a href="' + eventUrl(ev) + '">' + esc(K.plain(ev.title)) + '</a></h3></div>' +
      '</div>' +
      '<article class="evx-ticket mo-hover-glow" aria-label="' + esc(K.plain(ev.title)) + '">' +
        '<a class="evx-ticket-art" href="' + eventUrl(ev) + '" tabindex="-1" aria-hidden="true">' +
          (art ? '<img src="' + esc(art) + '" alt="" loading="lazy" decoding="async" />' : '') +
        '</a>' +
        '<div class="evx-ticket-stub">' +
          (ev.description ? '<p class="evx-ticket-desc">' + esc(K.excerpt(ev.description, 230)) + '</p>' : '') +
          (spec.length ? '<dl class="evx-spec">' + spec.map(function (m) {
            return '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>';
          }).join('') + '</dl>' : '') +
          '<div class="evx-ticket-actions">' +
            (reg ? '<a class="pg-btn pg-btn--primary mo-sheen xp-magnetic" href="' + esc(reg) + '" target="_blank" rel="noopener noreferrer">Register ' + ARROW + '</a>' : '') +
            '<a class="pg-btn' + (reg ? '' : ' pg-btn--primary mo-sheen xp-magnetic') + '" href="' + eventUrl(ev) + '">View details ' + ARROW + '</a>' +
          '</div>' +
        '</div>' +
      '</article>' +
    '</div>';
  }

  /* ── month rhythm ────────────────────────────────────────────── */

  function renderChart(evs) {
    var chart = doc.getElementById('evxChart');
    if (!chart) return;
    var dated = evs.filter(function (e) { return e._d; }).sort(function (a, b) { return a._d - b._d; });
    if (!dated.length) { chart.closest('.evx-rhythm').hidden = true; return; }
    var last = dated[dated.length - 1]._d;
    var first = dated[0]._d;
    var months = [];
    var cur = new Date(first.getFullYear(), first.getMonth(), 1);
    var end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cur <= end) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    if (months.length > 12) months = months.slice(-12);      /* the most recent year */
    var i = 0;
    chart.innerHTML = months.map(function (m) {
      var inMonth = dated.filter(function (e) { return e._d.getFullYear() === m.getFullYear() && e._d.getMonth() === m.getMonth(); });
      var label = K.MONTHS[m.getMonth()] + (m.getMonth() === 0 || m === months[0] ? ' ’' + String(m.getFullYear()).slice(2) : '');
      return '<li aria-label="' + esc(K.MONTHS[m.getMonth()] + ' ' + m.getFullYear() + ': ' + inMonth.length + (inMonth.length === 1 ? ' event' : ' events')) + '">' +
        '<span class="evx-col-n" aria-hidden="true">' + (inMonth.length || '') + '</span>' +
        '<span class="evx-stack" aria-hidden="true">' + inMonth.map(function (e) {
          return '<i class="evx-dot' + (isUpcoming(e) ? ' is-upcoming' : '') + '" style="--i:' + (i++) + '" title="' + esc(K.plain(e.title)) + '"></i>';
        }).join('') + '</span>' +
        '<span class="evx-col-m" aria-hidden="true">' + esc(label) + '</span>' +
      '</li>';
    }).join('');

    if ('IntersectionObserver' in win && !K.reduced()) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { chart.classList.add('is-in'); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(chart);
    } else chart.classList.add('is-in');
  }

  /* ── hero counts ─────────────────────────────────────────────── */

  function renderPulse(evs) {
    var up = evs.filter(isUpcoming).length;
    var latest = evs.filter(function (e) { return e._d && !isUpcoming(e); }).sort(function (a, b) { return b._d - a._d; })[0];
    var set = function (k, html) { var el = q('[data-evx="' + k + '"]'); if (el) el.innerHTML = html; };
    set('upcoming', String(up));
    set('total', String(evs.length));
    if (latest) { var dp = K.dateParts(latest._d); set('latest', dp.day + ' ' + dp.mon + '<small>' + esc(K.excerpt(latest.title, 34)) + '</small>'); }
    else set('latest', '&mdash;');
  }

  function settle(el, state, html) {
    el.innerHTML = html;
    el.setAttribute('data-state', state);
    el.removeAttribute('aria-busy');
  }

  function load() {
    var box = doc.getElementById('evxFeature');
    K.list('/events').then(function (evs) {
      evs = evs.filter(function (e) { return e && e.title; });
      evs.forEach(function (e) { e._d = K.parseDate(e.date); });
      renderPulse(evs);
      renderChart(evs);
      if (!evs.length) {
        settle(box, 'empty', '<p class="pg-note">No events have been published yet. New events will appear here as they are announced.</p>');
        return;
      }
      var f = pickFeatured(evs);
      var kick = doc.getElementById('evxFeatureKicker');
      var head = doc.getElementById('evxFeatureTitle');
      if (!isUpcoming(f)) {
        if (kick) kick.textContent = 'Most recent';
        if (head) head.textContent = 'The latest from the chapter';
      }
      settle(box, 'ready', renderFeature(f));
      K.reveal(qa('.evx-cal > *, .evx-ticket', box), 'scale');
      K.magnetic(box);
    }).catch(function (err) {
      console.warn('events-experience: events unavailable —', err.message);
      settle(box, 'error', '<p class="pg-note">The featured event could not be loaded right now. The full programme is below.</p>');
      var r = q('.evx-rhythm'); if (r) r.hidden = true;
      qa('.evx-pulse dd').forEach(function (dd) { dd.innerHTML = '&mdash;'; });
    });
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    var grid = doc.getElementById('eventsGrid');
    K.onRender(grid, tagGrid);
    if (win.EMBSMotion) win.EMBSMotion.watch(grid, '.ev-card', { variant: 'fade' });
    load();
  });

}(window, document));
