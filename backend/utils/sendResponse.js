const sendResponse = (res, statusCode, data = null, message = 'Success', meta = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  // Only present when the caller asked for a page, so the default shape is unchanged.
  if (meta) payload.meta = meta;
  res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, message = 'Something went wrong') => {
  res.status(statusCode).json({ success: false, message });
};

module.exports = { sendResponse, sendError };
