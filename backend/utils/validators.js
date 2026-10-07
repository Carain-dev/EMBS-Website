/* A practical address check. Besides the usual shape it rejects characters
   that have no place in a real address but do in markup — < > " ( ) , ; : [ ] \
   — so a "subscriber email" cannot carry HTML into the admin panel. */
const isEmail = (str) =>
  typeof str === 'string' &&
  str.length <= 254 &&
  /^[^\s@<>"(),;:[\]\\]+@[^\s@<>"(),;:[\]\\]+\.[^\s@<>"(),;:[\]\\]+$/.test(str);

const isDateString = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str);

const isUrl = (str) => {
  try { new URL(str); return true; } catch { return false; }
};

module.exports = { isEmail, isDateString, isUrl };
