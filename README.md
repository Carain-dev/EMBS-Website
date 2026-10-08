<div align="center">

<img src="embs-logo.png" alt="IEEE EMBS KPRIET logo" width="110" />

# IEEE EMBS Student Chapter — KPRIET

The official website and content management system for the IEEE Engineering in Medicine and Biology Society (EMBS) student chapter at KPR Institute of Engineering and Technology, Coimbatore.

**[Live site](https://embs-website-chi.vercel.app/)** · [Admin panel](https://embs-website-chi.vercel.app/admin) · [Report an issue](https://github.com/Carain-dev/EMBS-Website/issues)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?logo=cloudinary&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-0AE448?logo=greensock&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=black)

</div>

---

## About

The chapter needed a website that office bearers could keep up to date themselves, without touching code every time there's a new event, blog post or achievement.

This project does that in two parts:

- **A public website** where students and faculty can browse events, projects, blogs, podcasts, the gallery, members and announcements, with scroll-driven animations on every page and a 3D heart loader on the home page.
- **An admin panel (CMS)** where logged-in team members add, edit and remove that content from the browser. Changes show up on the public site straight away.

<!-- Add screenshots here, e.g.
<p align="center">
  <img src="docs/screenshots/home.png" width="49%" />
  <img src="docs/screenshots/admin-dashboard.png" width="49%" />
</p>
-->

---

## Features

### Public website

- **Home** with a live announcement ticker, chapter stats and featured events
- **Events** listing plus a detail page for each event
- **Projects & research** with category filters and project detail pages
- **Blog** with article pages and auto-calculated read time
- **Podcast** episodes
- **Gallery**, **Members** directory and **Achievements**
- **Announcements**, including pinned and auto-expiring ones
- **About** page with the chapter timeline and faculty coordinators
- **Contact form** and **newsletter sign-up**
- **Updates feed** that pulls the latest items from every section into one list
- Responsive layout, a branded 404 page, SEO / Open Graph tags and basic accessibility (skip links, ARIA states, keyboard-friendly menu, reduced-motion support)

### Motion and the 3D loader

- **3D heart loader (home page):** a real anatomical heart model rendered with Three.js, with a heartbeat and a conduction wave in the site's teal and labelled electrode points (RA, RV …) that explain each chamber. Biomedical facts rotate while it loads.
- **The loader does a real job, not just decoration.** The free Render backend sleeps when idle, so the loader:
  - pings `/api/health` the moment the page opens to wake the API
  - waits until the home page's key data (events, members) has actually arrived
  - retries automatically if the API is still waking up, and offers *Try again* or *Continue* if it takes too long
  - is skipped on repeat visits within 10 minutes, once the API is already awake
- **Built to stay fast on any device:** the 3D layer loads only after the first paint, and it can never block or delay the site. It picks a quality tier from screen size, CPU cores and memory, uses a lighter model on phones, and falls back to a still image if WebGL fails.
- **Page animations with GSAP + ScrollTrigger:** each page has its own animation engine (`*-experience.js`) built on a shared core (`experience-core.js`), so the whole site uses one motion style. This covers line-by-line text reveals, scroll-scrubbed sections, parallax depth, cursor-following light, magnetic buttons and glowing cards.
- **Content from the CMS animates too:** a MutationObserver spots cards the API adds after the page loads and animates them in, with no changes needed to the data scripts.
- **Responsive motion tiers:** full effects on desktop, lighter ones on tablets and simple reveals on phones.
- **Accessible:** respects `prefers-reduced-motion` (including when the setting changes while the page is open), pauses off-screen animations and skips pointer effects on touch screens.

### Admin panel (`/admin`)

- Login with JWT auth and **role-based access** (`admin`, `editor`, `viewer`)
- **Dashboard** with content stats
- Full create / edit / delete for **events, projects, blogs, podcasts, gallery, members, achievements, announcements** and the **chapter timeline**
- **Image uploads** to Cloudinary
- **Newsletter** management: view subscribers and send emails
- **Site settings**: branding (logo, favicon) and hero images for each page
- A **"Show in updates"** toggle on content so it appears in the central updates feed
- Subscribers are emailed automatically when new events, podcasts or announcements are published

---

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript (no framework, no build step) |
| Animation & 3D | GSAP 3 + ScrollTrigger, Three.js (r160, glTF + Meshopt), IntersectionObserver / MutationObserver |
| Backend | Node.js, Express.js, REST API |
| Database | MongoDB Atlas with Mongoose |
| Auth | JSON Web Tokens, bcrypt password hashing, httpOnly cookies |
| File storage | Cloudinary (via Multer) |
| Email | Nodemailer (SMTP) |
| Security | Helmet, express-rate-limit, CORS allowlist |
| Hosting | Vercel (frontend), Render (backend) |

---

## How it works

```text
┌──────────────────────────┐                      ┌──────────────────────────┐
│  Static site (Vercel)    │  ── fetch / JSON ──▶ │  Express API (Render)    │
│  HTML + CSS + JS         │  ◀───────────────────│  Node + Mongoose         │
└──────────────────────────┘                      └────────────┬─────────────┘
                                                               │
                                              ┌────────────────┴───────────────┐
                                              ▼                                ▼
                                     ┌─────────────────┐             ┌──────────────────┐
                                     │  MongoDB Atlas  │             │    Cloudinary    │
                                     │  content data   │             │  uploaded media  │
                                     └─────────────────┘             └──────────────────┘
```

The frontend and backend are deployed separately. Every page loads [`config.js`](config.js) first, which sets the API address in one place:

- on `localhost` it points at `http://localhost:5000/api`
- everywhere else it points at the live Render API

So switching backends is a one-line change.

---

## Project structure

```text
EMBS-Website/
├── index.html, about.html, events.html, ...   Public pages
├── event.html, project.html, post.html         Detail pages (read ?id= from the URL)
├── *.css / *.js                                Page styles and data scripts
├── *-experience.js / *-experience.css          Per-page GSAP animation engines
├── experience-core.js                          Shared animation building blocks
├── motion.js, animations.js                    Lightweight reveal / parallax layer (no dependencies)
├── loader.js, loader.css                       Startup loader logic (API wake-up, readiness)
├── loader/                                     3D heart scene (Three.js), UI, assets, vendored libs
├── config.js                                   API address + social links
├── api.js                                      Shared fetch helper
├── navbar.js, navbar.css, responsive.css       Shared layout
│
├── admin/                                      Admin panel (login, dashboard, one page per section)
│
├── backend/
│   ├── server.js                               App entry: middleware, CORS, routes
│   ├── config/                                 Database, Cloudinary, JWT setup
│   ├── models/                                 Mongoose schemas
│   ├── controllers/                            Request handlers
│   ├── routes/                                 API route definitions
│   ├── middleware/                             Auth, uploads, error handling
│   ├── utils/                                  Email, pagination, validation helpers
│   ├── seedContent.js                          Safe demo-content seeder
│   └── seed.js                                 Full reset (destructive, see below)
│
├── audit/                                      Automated API + browser test suites
│
├── vercel.json                                 Headers, caching, /admin rewrite
└── .vercelignore                               Keeps backend/ out of the Vercel deploy
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- A [MongoDB Atlas](https://www.mongodb.com/atlas) database
- A [Cloudinary](https://cloudinary.com) account (for image uploads)
- An SMTP email account (Gmail with an App Password works)

### 1. Clone the repo

```bash
git clone https://github.com/Carain-dev/EMBS-Website.git
cd EMBS-Website
```

### 2. Start the backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in your own values
npm run dev               # runs on http://localhost:5000
```

Check it's running:

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"Server is running"}
```

### 3. Start the frontend

From the project root, in a second terminal:

```bash
npx serve .
```

Open the address it prints (usually `http://localhost:3000`). Because you're on localhost, `config.js` automatically talks to your local backend.

> The pages use JavaScript modules, so opening the HTML files directly (`file://`) won't work. Always serve the folder.

---

## Environment variables

Create `backend/.env` from [`backend/.env.example`](backend/.env.example).

| Variable | What it's for |
| --- | --- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Extra allowed frontend origins, comma-separated (e.g. a Vercel preview URL or a custom domain) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `COOKIE_EXPIRES_IN` | Cookie lifetime in days, e.g. `7` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Contact form and newsletter emails |

> Never commit `backend/.env`. It's already in `.gitignore`.

---

## API overview

All routes are under `/api`. Reading content is public; creating and editing needs an `admin` or `editor` login, and deleting needs `admin`.

| Resource | Endpoint |
| --- | --- |
| Auth | `/api/auth` (`login`, `logout`, `me`, `update-me`, `update-password`, admin-only `register`) |
| Events | `/api/events` |
| Projects | `/api/projects` |
| Blogs | `/api/blogs` |
| Podcasts | `/api/podcasts` |
| Gallery | `/api/gallery` |
| Members | `/api/members` |
| Achievements | `/api/achievements` |
| Announcements | `/api/announcements` |
| Timeline | `/api/timeline` |
| Documents | `/api/documents` |
| Site settings | `/api/site-settings` |
| Updates feed | `/api/updates` |
| Dashboard stats | `/api/dashboard/stats` |
| Newsletter | `/api/newsletter` (`subscribe`, `unsubscribe`, admin `send`) |
| Contact | `/api/contact` |
| Health check | `/api/health` |

Content resources follow the same pattern: `GET /`, `GET /:id`, `POST /`, `PATCH /:id` (events use `PUT`), `DELETE /:id`. List endpoints support optional pagination with `?page=` and `?limit=` (max 100).

---

## Deployment

### Frontend → Vercel

1. Import the repo into [Vercel](https://vercel.com).
2. Set **Framework Preset** to `Other` and leave the build, output and install commands empty.
3. Deploy. `vercel.json` already handles headers, caching and the `/admin` route.

Every push to `main` redeploys automatically.

### Backend → Render

1. Create a **Web Service** on [Render](https://render.com) from this repo.
2. Set **Root Directory** to `backend`, **Build Command** to `npm install` and **Start Command** to `npm start`.
3. Add the environment variables listed above, with `NODE_ENV=production`.
4. Put the service URL (ending in `/api`) in `config.js`.

For security, the API only accepts logged-in requests from the production site's domains (listed in `backend/server.js`) and from localhost. It doesn't trust every `*.vercel.app` site, because anyone can deploy there. To allow a preview deployment or a custom domain, add it to `CLIENT_URL`.

> Render's free tier sleeps after about 15 minutes of no traffic, so the first request after that can take 30–50 seconds.

---

## Demo content

To fill empty sections with sample data:

```bash
cd backend
npm run seed:content          # dry run: shows what it would add, changes nothing
npm run seed:content:apply    # actually writes
```

It only adds to collections that are empty, so it never overwrites real content.

> ⚠️ `seed.js` is a **full reset**. It deletes users (including the admin account), events and members. It refuses to run without `--force`. Use `seedContent.js` for normal work.

---

## Testing

The `audit/` folder has automated test suites for the API and the browser:

```bash
node audit/run.mjs           # everything
node audit/run.mjs api       # API suite only
node audit/run.mjs browser   # browser suite (headless Chrome)
node audit/run.mjs prod      # read-only checks against production
```

The suites that change data run against a **separate throwaway database** (`embs-audit-tmp`) on port 5055, with a fake email server. A guard blocks any request that would change production data before it is sent. The production suite only reads.

> Needs `backend/.env` and installed backend dependencies. The browser suite currently looks for Chrome in the default Windows install path.

---

## Security notes

- Admin registration is admin-only, and roles are validated on the server.
- Login is rate-limited (10 failed attempts per 15 minutes) and inputs are type-checked.
- Passwords are hashed with bcrypt; sessions use an httpOnly, Secure cookie.
- CORS allows only the production domains, `CLIENT_URL` and localhost, not every `*.vercel.app` site.
- User-submitted text is HTML-escaped before it goes into emails.
- Helmet sets security headers and request bodies are capped at 1 MB.

---

## Troubleshooting

| Problem | Likely fix |
| --- | --- |
| Pages load but content is empty, CORS error in console | Add your frontend's domain to `CLIENT_URL` on the backend and redeploy |
| Loader stays on screen for a while on the first visit | The free Render backend was asleep. The loader is waking it up and will continue once it responds |
| The 3D heart doesn't appear | WebGL is unavailable or the device is low-power. The loader shows a still image instead, which is expected |
| Nothing animates | Check whether *Reduce motion* is on in your OS settings. If it is, the site turns animations off on purpose |
| Nothing loads when opening an HTML file directly | Serve the folder with `npx serve .` |
| Uploaded images don't show | Check the three `CLOUDINARY_*` variables |
| Admin login says "Could not reach the server" | Open `<your-api>/api/health` and wait for it to respond |

---

## Author

Built and maintained by **[Carain-dev](https://github.com/Carain-dev)** for the IEEE EMBS Student Chapter, KPR Institute of Engineering and Technology.

## Credits

- 3D heart model: **"Human heart for Cycles"** by **elZancudo**, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). It was converted to GLB, compressed, retextured and given a mobile version for this site. See [`loader/assets/CREDITS.md`](loader/assets/CREDITS.md).
- [Three.js](https://threejs.org) (MIT) and [GSAP](https://gsap.com).

## License

This project is licensed under the MIT License (as declared in `backend/package.json`). Third-party assets keep their own licences, listed above.
