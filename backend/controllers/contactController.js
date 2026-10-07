const asyncHandler = require('express-async-handler');
const sendEmail    = require('../utils/sendEmail');
const { sendResponse, sendError } = require('../utils/sendResponse');
const { escapeHtml } = require('../utils/escapeHtml');
const { isEmail } = require('../utils/validators');

const LIMITS = { name: 200, email: 254, subject: 300, message: 10000 };

exports.submitContact = asyncHandler(async (req, res) => {
  const fields = {};
  for (const key of Object.keys(LIMITS)) {
    const value = req.body[key];
    /* Strings only: an object would be interpolated as "[object Object]". */
    if (value !== undefined && typeof value !== 'string')
      return sendError(res, 400, 'Invalid form data');
    fields[key] = (value || '').trim();
  }
  const { name, email, subject, message } = fields;

  if (!name || !email || !subject || !message)
    return sendError(res, 400, 'All fields are required');

  if (!isEmail(email))
    return sendError(res, 400, 'Please enter a valid email address');

  for (const [key, max] of Object.entries(LIMITS))
    if (fields[key].length > max) return sendError(res, 400, `${key[0].toUpperCase() + key.slice(1)} is too long`);

  /* Everything below lands in an HTML email, so escape the visitor's text:
     unescaped, a message could inject links, images or markup into the
     chapter's inbox. */
  const h = { name: escapeHtml(name), email: escapeHtml(email), subject: escapeHtml(subject), message: escapeHtml(message) };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6B2D8B; border-bottom: 2px solid #00A99D; padding-bottom: 8px;">
        New Contact Form Submission — IEEE EMBS
      </h2>
      <table style="width:100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-weight: bold; width: 100px;">Name</td>
          <td style="padding: 8px;">${h.name}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="padding: 8px; font-weight: bold;">Email</td>
          <td style="padding: 8px;"><a href="mailto:${encodeURIComponent(email)}">${h.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Subject</td>
          <td style="padding: 8px;">${h.subject}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="padding: 8px; font-weight: bold; vertical-align: top;">Message</td>
          <td style="padding: 8px; white-space: pre-line;">${h.message}</td>
        </tr>
      </table>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">
        Sent from the IEEE EMBS website contact form.
      </p>
    </div>
  `;

  await sendEmail({
    to: process.env.EMAIL_USER,
    subject: `[EMBS Contact] ${subject.replace(/[\r\n]+/g, ' ')}`,
    replyTo: email,
    html,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`,
  });

  sendResponse(res, 200, null, 'Message sent successfully');
});
