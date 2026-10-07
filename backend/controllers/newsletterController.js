const asyncHandler = require('express-async-handler');
const Subscriber   = require('../models/Subscriber');
const sendEmail    = require('../utils/sendEmail');
const { escapeHtml } = require('../utils/escapeHtml');
const { isEmail } = require('../utils/validators');
const { sendResponse, sendError } = require('../utils/sendResponse');

/* ── Subscribe ───────────────────────────────────────────────────────────── */
exports.subscribe = asyncHandler(async (req, res) => {
  const { email: rawEmail } = req.body;
  if (!rawEmail) return sendError(res, 400, 'Email is required');

  /* Basic format guard — reject obviously malformed addresses */
  if (typeof rawEmail !== 'string' || !isEmail(rawEmail.trim()))
    return sendError(res, 400, 'Invalid email address');

  /* Stored lowercase by the schema, so look it up the same way; otherwise a
     differently-cased duplicate hit the unique index as a generic 400. */
  const email = rawEmail.trim().toLowerCase();
  const existing = await Subscriber.findOne({ email });
  if (existing) return sendError(res, 409, 'Email already subscribed');

  await Subscriber.create({ email });
  sendResponse(res, 201, null, 'Subscribed successfully');
});

/* ── List all subscribers (admin only) ──────────────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 });
  sendResponse(res, 200, subscribers);
});

/* ── Unsubscribe ─────────────────────────────────────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, 400, 'Email is required');

  /* Reject non-string input. Without this, a body like {"email":{"$ne":null}}
     reaches Mongo as a query operator and deletes an arbitrary subscriber. */
  if (typeof email !== 'string')
    return sendError(res, 400, 'Invalid email address');

  const sub = await Subscriber.findOneAndDelete({ email: email.trim().toLowerCase() });
  if (!sub) return sendError(res, 404, 'Subscriber not found');
  sendResponse(res, 200, null, 'Unsubscribed successfully');
});

/* ── Send newsletter (admin only) ────────────────────────────────────────── */
exports.sendNewsletter = asyncHandler(async (req, res) => {
  const { subject, html, text } = req.body;

  if (!subject || !subject.trim())
    return sendError(res, 400, 'Subject is required');
  if (!html && !text)
    return sendError(res, 400, 'Email content (html or text) is required');

  /* Retrieve all active subscribers — send only to known addresses */
  const subscribers = await Subscriber.find().select('email').lean();

  if (!subscribers.length)
    return sendResponse(res, 200, { sent: 0, failed: 0 }, 'No subscribers to send to');

  const results = { sent: 0, failed: 0, errors: [] };

  /* Send to each subscriber individually.
     Per-address failures are caught so one bad address cannot abort the
     whole batch.  SMTP connection errors that affect every send will still
     be reported in the errors array. */
  for (const sub of subscribers) {
    try {
      await sendEmail({
        to:      sub.email,
        subject: subject.trim(),
        html:    html   || `<p>${escapeHtml(text || '').replace(/\n/g, '<br>')}</p>`,
        text:    text   || subject.trim(),
      });
      results.sent++;
    } catch (err) {
      results.failed++;
      results.errors.push({ email: sub.email, error: err.message });
      console.error(`[Newsletter] Failed to send to ${sub.email}:`, err.message);
    }
  }

  const message = `Newsletter sent: ${results.sent} delivered, ${results.failed} failed`;
  sendResponse(res, 200, { sent: results.sent, failed: results.failed, errors: results.errors }, message);
});
