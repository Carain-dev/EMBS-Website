const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'development') console.error(err.stack);
  else if (statusCode >= 500) console.error(`[error] ${req.method} ${req.originalUrl}: ${message}`);

  // Malformed value for a typed field (e.g. "abc" for a number or ObjectId).
  // Mongoose's own message names models and internals, so keep it generic.
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for ${err.path}` });
  }

  // Upload limits (file too large, too many files, unexpected field)
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => (e.name === 'CastError' ? `Invalid value for ${e.path}` : e.message))
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  // Server-side failures (database, mail transport, Cloudinary…) must not echo
  // internal details such as hosts, ports or driver messages to the client.
  if (statusCode >= 500) {
    return res.status(statusCode).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorMiddleware;
