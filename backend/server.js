require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const cookieParser  = require('cookie-parser');
const helmet        = require('helmet');
const compression   = require('compression');
const rateLimit     = require('express-rate-limit');
const connectDB     = require('./config/database');
const errorMiddleware = require('./middleware/errorMiddleware');

const authRoutes         = require('./routes/authRoutes');
const eventRoutes        = require('./routes/eventRoutes');
const podcastRoutes      = require('./routes/podcastRoutes');
const blogRoutes         = require('./routes/blogRoutes');
const memberRoutes       = require('./routes/memberRoutes');
const achievementRoutes  = require('./routes/achievementRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const galleryRoutes      = require('./routes/galleryRoutes');
const projectRoutes      = require('./routes/projectRoutes');
const newsletterRoutes   = require('./routes/newsletterRoutes');
const contactRoutes      = require('./routes/contactRoutes');

const app = express();

/* ── CORS ────────────────────────────────────── */
// Hosts we always trust: the preview/production domains of our static hosts,
// plus anything explicitly listed in CLIENT_URL (comma-separated).
const ALLOWED_SUFFIXES = ['.vercel.app', '.netlify.app'];

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || '')
  .split(',')
  .map(url => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isLocalhost = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const isAllowedOrigin = (origin) => {
  // Same-origin requests, curl and server-to-server calls send no Origin header.
  if (!origin) return true;

  const clean = origin.replace(/\/$/, '');

  if (ALLOWED_ORIGINS.includes(clean)) return true;
  if (isLocalhost(clean)) return true;

  try {
    const { hostname } = new URL(clean);
    return ALLOWED_SUFFIXES.some(suffix => hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

app.use(cors({
  // Returning `false` omits the CORS headers so the browser reports a normal
  // CORS failure. Passing an Error here would surface as a confusing 500.
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true
}));

/* ── Core Middleware ─────────────────────────── */

/* Render sits behind a proxy. Without this, express-rate-limit sees every
   request as coming from the same proxy IP and would throttle all users
   together instead of per visitor. */
app.set('trust proxy', 1);

/* Security headers. crossOriginResourcePolicy is relaxed because the API
   serves images that the site loads from a different origin. */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(compression());

/* JSON bodies are small here; a cap stops a huge payload tying up memory. */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

/* The admin panel is one shared password, so an unthrottled login endpoint is
   an open invitation to guess it. Only failed attempts count toward the limit,
   so a legitimate admin logging in repeatedly is unaffected. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use('/api/auth/login', loginLimiter);

/* A wider limit for everything else, to blunt scraping and accidental loops. */
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
}));

/* ── Static Uploads ──────────────────────────── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── Routes ──────────────────────────────────── */
app.use('/api/auth',          authRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/podcasts',      podcastRoutes);
app.use('/api/blogs',         blogRoutes);
app.use('/api/members',       memberRoutes);
app.use('/api/achievements',  achievementRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/gallery',       galleryRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/api/newsletter',    newsletterRoutes);
app.use('/api/contact',       contactRoutes);

/* ── Health Check ────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

/* ── 404 Handler ─────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/* ── Global Error Handler ────────────────────── */
app.use(errorMiddleware);

/* ── Start Server ────────────────────────────── */
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

start();
