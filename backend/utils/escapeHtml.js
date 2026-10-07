/* Escape text for safe interpolation into HTML (emails built from user or
   CMS text). Non-strings are stringified; null/undefined become ''. */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) =>
  (value === null || value === undefined ? '' : String(value)).replace(/[&<>"']/g, (c) => MAP[c]);

module.exports = { escapeHtml };
