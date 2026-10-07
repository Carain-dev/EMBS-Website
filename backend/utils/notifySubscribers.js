/**
 * notifySubscribers.js
 *
 * Fire-and-forget newsletter notification utility.
 * Called after a piece of content is published.
 *
 * Rules:
 *  - Runs asynchronously — NEVER blocks or rejects the calling controller.
 *  - A failure in email delivery does NOT affect the published item.
 *  - Sends to each subscriber individually (no CC/BCC leakage).
 *  - Uses the existing nodemailer transporter via sendEmail().
 */

'use strict';

const Subscriber = require('../models/Subscriber');
const sendEmail  = require('./sendEmail');
const { escapeHtml: e } = require('./escapeHtml');

/* CMS text is plain text; escape it for the HTML part (the text part is untouched). */
const safeHref = (u) => (/^https?:\/\//i.test(String(u || '')) ? e(u) : '');

const SITE_NAME  = process.env.SITE_NAME  || 'IEEE EMBS Student Chapter';
const SITE_URL   = process.env.CLIENT_URL || 'https://ieeekpriet.in';
const BRAND_COLOR = '#6B2D8B';
const TEAL_COLOR  = '#00A99D';

/* ── Shared email shell ─────────────────────────────────────────────────── */
function wrapHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                      overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_COLOR},${TEAL_COLOR});
                       padding:28px 32px;text-align:center;">
              <span style="font-size:1.15rem;font-weight:700;color:#ffffff;
                           letter-spacing:0.04em;">${SITE_NAME}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 28px;border-top:1px solid #ebebf0;">
              <p style="margin:0;font-size:0.75rem;color:#9a9fb8;text-align:center;line-height:1.6;">
                You are receiving this because you subscribed to updates from
                <a href="${SITE_URL}" style="color:${TEAL_COLOR};text-decoration:none;">${SITE_NAME}</a>.<br/>
                To unsubscribe, reply with "unsubscribe" in the subject line.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label, url) {
  return `<a href="${url}" target="_blank"
     style="display:inline-block;margin-top:20px;padding:12px 28px;
            background:linear-gradient(90deg,${BRAND_COLOR},${TEAL_COLOR});
            color:#ffffff;text-decoration:none;border-radius:8px;
            font-weight:600;font-size:0.88rem;letter-spacing:0.03em;">
    ${label} &rarr;
  </a>`;
}

/* ── Email builders ─────────────────────────────────────────────────────── */

function buildAnnouncementEmail(item) {
  const url   = `${SITE_URL}/announcements.html`;
  const title = item.title || 'New Announcement';
  const body  = item.body  || '';
  const excerpt = body.length > 200 ? body.slice(0, 200).trimEnd() + '…' : body;

  return {
    subject: `📢 New Announcement: ${title}`,
    html: wrapHtml(e(title), `
      <h1 style="margin:0 0 8px;font-size:1.3rem;color:#0d1030;font-weight:700;">${e(title)}</h1>
      ${item.expiresAt
        ? `<p style="margin:0 0 16px;font-size:0.78rem;color:${TEAL_COLOR};font-weight:600;">
             Valid until: ${new Date(item.expiresAt).toLocaleDateString('en-IN', { day:'numeric',month:'long',year:'numeric' })}
           </p>`
        : ''}
      ${excerpt
        ? `<p style="margin:0 0 16px;font-size:0.92rem;color:#4a5070;line-height:1.7;">${e(excerpt)}</p>`
        : ''}
      ${ctaButton('View Announcement', url)}
    `),
    text: `New Announcement: ${title}\n\n${body}\n\n${url}`,
  };
}

function buildEventEmail(item) {
  const url  = `${SITE_URL}/events.html`;
  const title = item.title || 'New Event';

  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : '';
  const timeStr = item.time || '';
  const venue   = item.venue || item.location || '';
  const desc    = (item.description || '').slice(0, 200).trimEnd();

  return {
    subject: `🗓️ New Event: ${title}`,
    html: wrapHtml(e(title), `
      <h1 style="margin:0 0 12px;font-size:1.3rem;color:#0d1030;font-weight:700;">${e(title)}</h1>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        ${dateStr  ? `<tr><td style="padding:3px 12px 3px 0;font-size:0.78rem;color:#9a9fb8;font-weight:600;white-space:nowrap;">DATE</td><td style="font-size:0.9rem;color:#0d1030;">${dateStr}</td></tr>` : ''}
        ${timeStr  ? `<tr><td style="padding:3px 12px 3px 0;font-size:0.78rem;color:#9a9fb8;font-weight:600;white-space:nowrap;">TIME</td><td style="font-size:0.9rem;color:#0d1030;">${e(timeStr)}</td></tr>` : ''}
        ${venue    ? `<tr><td style="padding:3px 12px 3px 0;font-size:0.78rem;color:#9a9fb8;font-weight:600;white-space:nowrap;">VENUE</td><td style="font-size:0.9rem;color:#0d1030;">${e(venue)}</td></tr>` : ''}
      </table>
      ${desc ? `<p style="margin:0 0 4px;font-size:0.92rem;color:#4a5070;line-height:1.7;">${e(desc)}${(item.description||'').length > 200 ? '…' : ''}</p>` : ''}
      ${ctaButton('View Event Details', url)}
    `),
    text: `New Event: ${title}\n${dateStr}${timeStr ? ' at ' + timeStr : ''}${venue ? '\n' + venue : ''}\n\n${item.description || ''}\n\n${url}`,
  };
}

function buildPodcastEmail(item) {
  const url     = `${SITE_URL}/podcast.html`;
  const epNum   = item.episodeNumber ? `EP ${String(item.episodeNumber).padStart(2, '0')}: ` : '';
  const title   = item.title || 'New Episode';
  const guest   = item.guestName || '';
  const guestDes = item.guestDesignation || '';
  const desc    = (item.description || '').slice(0, 200).trimEnd();
  const spotifyLink = safeHref(item.spotifyUrl) ? item.spotifyUrl : url;

  return {
    subject: `🎙️ New Podcast Episode: ${epNum}${title}`,
    html: wrapHtml(e(`${epNum}${title}`), `
      <span style="display:inline-block;font-size:0.68rem;font-weight:700;letter-spacing:0.12em;
                   text-transform:uppercase;color:${TEAL_COLOR};margin-bottom:8px;">New Episode</span>
      <h1 style="margin:0 0 12px;font-size:1.3rem;color:#0d1030;font-weight:700;">${e(epNum + title)}</h1>
      ${guest ? `
        <p style="margin:0 0 12px;font-size:0.88rem;color:#6B2D8B;font-weight:600;">
          Guest: ${e(guest)}${guestDes ? ` — ${e(guestDes)}` : ''}
        </p>` : ''}
      ${desc ? `<p style="margin:0 0 4px;font-size:0.92rem;color:#4a5070;line-height:1.7;">${e(desc)}${(item.description||'').length > 200 ? '…' : ''}</p>` : ''}
      <div style="margin-top:20px;display:inline-flex;gap:12px;flex-wrap:wrap;">
        ${ctaButton('🎧 Listen on Spotify', e(spotifyLink))}
      </div>
    `),
    text: `New Podcast Episode: ${epNum}${title}\n${guest ? 'Guest: ' + guest + '\n' : ''}\n${item.description || ''}\n\nListen: ${spotifyLink}`,
  };
}

/* ── Core dispatcher ─────────────────────────────────────────────────────── */

/**
 * Sends a notification email to all subscribers.
 * This function is intentionally FIRE-AND-FORGET:
 *   - It starts the async work but does NOT return a promise the caller awaits.
 *   - All failures are caught and logged, never propagated.
 *   - The calling controller returns success BEFORE emails are sent.
 *
 * @param {'announcement'|'event'|'podcast'} type
 * @param {Object} item  The saved/published document (plain object or Mongoose doc)
 */
function notifySubscribers(type, item) {
  /* Kick off without awaiting — caller continues immediately */
  setImmediate(async () => {
    try {
      /* Build the email payload for this content type */
      let payload;
      if (type === 'announcement') payload = buildAnnouncementEmail(item);
      else if (type === 'event')   payload = buildEventEmail(item);
      else if (type === 'podcast') payload = buildPodcastEmail(item);
      else {
        console.warn(`[Notify] Unknown content type: ${type}`);
        return;
      }

      /* Get all subscriber emails */
      const subscribers = await Subscriber.find().select('email').lean();
      if (!subscribers.length) {
        console.log(`[Notify] No subscribers to notify (type=${type})`);
        return;
      }

      let sent = 0, failed = 0;
      for (const sub of subscribers) {
        try {
          await sendEmail({ to: sub.email, ...payload });
          sent++;
        } catch (err) {
          failed++;
          console.error(`[Notify] Failed to send to ${sub.email}:`, err.message);
        }
      }
      console.log(`[Notify] ${type} notification: ${sent} sent, ${failed} failed`);
    } catch (err) {
      /* Top-level catch — never let an error escape and affect the server */
      console.error('[Notify] Unexpected error in notifySubscribers:', err.message);
    }
  });
}

module.exports = notifySubscribers;
