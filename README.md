# IEEE EMBS Student Chapter — KPRIET

Website for the IEEE Engineering in Medicine and Biology Society student chapter at KPR Institute of Engineering and Technology.

It is a multi-page website with a matching admin panel, so chapter content (events, members, projects, blogs, podcasts, gallery, achievements, announcements) can be updated from a browser without editing any code.

> **Taking over this project?** Start with [HANDOFF.md](HANDOFF.md) for the deploy steps and outstanding items, then come back here for the details.

---

## Table of contents

1. [What's in here](#whats-in-here)
2. [How it fits together](#how-it-fits-together)
3. [Running it locally](#running-it-locally)
4. [Deploying the website to Vercel](#deploying-the-website-to-vercel)
5. [The backend API on Render](#the-backend-api-on-render)
6. [Using the admin panel](#using-the-admin-panel)
7. [Adding demo content](#adding-demo-content)
8. [Troubleshooting](#troubleshooting)

---

## What's in here

```text
embs-website/
├── index.html              Home
├── about.html              About, vision, history, core team
├── activities.html         Activities overview
├── events.html             Events listing            (loads from API)
├── projects.html           Projects listing          (loads from API)
├── project.html            Single project detail     (loads from API, ?id=…)
├── blog.html               Blog listing              (loads from API)
├── podcast.html            Podcast episodes          (loads from API)
├── gallery.html            Photo gallery             (loads from API)
├── members.html            Member directory          (loads from API)
├── achievements.html       Achievements              (loads from API)
├── announcements.html      Announcements             (loads from API)
├── contact.html            Contact form              (posts to API)
│
├── config.js               THE backend address — the only place it is set
├── navbar.css              Shared navbar, footer, home page styles
├── api.js                  Central fetch helper used by the module scripts
├── navbar.js               Navbar, mobile drawer, dropdowns
│
├── admin/                  Password-protected content manager (10 pages)
│
├── backend/                Express + MongoDB API
│   ├── server.js           App entry, CORS, route mounting
│   ├── models/             Mongoose schemas
│   ├── controllers/        Route handlers
│   ├── routes/             Route definitions
│   ├── middleware/         Auth, uploads, error handling
│   ├── seed.js             DESTRUCTIVE reset — see warning below
│   └── seedContent.js      Safe additive seeder
│
├── vercel.json             Vercel static hosting config
└── .vercelignore           Keeps backend/ out of the Vercel deploy
```

---

## How it fits together

The site is deliberately split in two, and the two halves deploy independently.

```text
┌──────────────────────────┐        HTTPS         ┌──────────────────────────┐
│  Static site on Vercel   │  ──── fetch ────▶    │  Express API on Render   │
│  HTML + CSS + JS         │                      │  Node + Mongoose         │
│  no build step           │  ◀─── JSON ─────     │                          │
└──────────────────────────┘                      └────────────┬─────────────┘
                                                               │
                                              ┌────────────────┴───────────────┐
                                              │                                │
                                     ┌────────▼────────┐             ┌─────────▼────────┐
                                     │ MongoDB Atlas   │             │   Cloudinary     │
                                     │ content records │             │  uploaded images │
                                     └─────────────────┘             └──────────────────┘
```

There is **no build step** for the website. The `.html`, `.css` and `.js` files are served exactly as they are, which is why Vercel needs no framework setting.

The backend address lives in exactly one place, [`config.js`](config.js):

```js
window.EMBS_API_BASE = 'https://embs-website-89fl.onrender.com/api';
```

Every page, public and admin, loads that file before its own scripts. To point
the whole site at a different backend, change that single line. Nothing else
in the project hardcodes the URL.

---

## Running it locally

You need [Node.js](https://nodejs.org) 18 or newer.

### The website

The pages are plain HTML, but they use JavaScript modules, which browsers refuse to load from a `file://` path. Serve the folder over HTTP instead:

```bash
npx serve .
```

Then open the address it prints (usually `http://localhost:3000`).

By default the local pages still talk to the **live** API on Render, so you will see real content straight away.

### The backend

Only needed if you are changing the API itself.

```bash
cd backend
npm install
cp .env.example .env      # then fill in the real values
npm run dev               # starts on http://localhost:5000
```

Check it is alive:

```bash
curl http://localhost:5000/api/health
```

To point the website at your local API, change the one line in `config.js` to `http://localhost:5000/api`. Localhost origins are already allowed by CORS.

> **Never commit `backend/.env`.** It holds live database and API credentials. It is already listed in `.gitignore`.

---

## Deploying the website to Vercel

Vercel's free Hobby tier is enough for this site. These steps deploy the **website only** — the API stays on Render.

### 1. Create a Vercel account

Go to [vercel.com/signup](https://vercel.com/signup) and sign up with the **same GitHub account that owns this repository**. That way Vercel can see the repo without any extra permissions.

### 2. Import the repository

1. On the Vercel dashboard, click **Add New → Project**.
2. Find `embs-website` in the repository list and click **Import**.
   (If it is not listed, click *Adjust GitHub App Permissions* and grant access to the repo.)

### 3. Configure the project

Vercel will try to auto-detect a framework. There isn't one, so set:

| Setting              | Value                          |
| -------------------- | ------------------------------ |
| **Framework Preset** | `Other`                        |
| **Root Directory**   | `./` (leave as is)             |
| **Build Command**    | leave **empty**                |
| **Output Directory** | leave **empty**                |
| **Install Command**  | leave **empty**                |

`vercel.json` in this repo already handles caching headers, security headers, and the `/admin` route, so you should not need to change anything else.

### 4. Deploy

Click **Deploy**. It takes well under a minute since nothing is compiled.

You will get a URL like `https://embs-website.vercel.app`. That is the live site.

### 5. Check it worked

Open the deployed URL and confirm:

- The home page loads with the announcement ticker running.
- **Events** and **Members** show real content (this proves the API connection works).
- The hamburger menu opens on a phone-sized screen.
- `https://your-site.vercel.app/admin` shows the login page.

### Redeploying later

Every push to the `main` branch redeploys automatically. Pushes to other branches get their own preview URL, which is handy for testing before it goes live.

---

## The backend API on Render

The API already runs at `https://embs-website-89fl.onrender.com`. You only need this section if you are redeploying it.

### Environment variables

Set these in the Render dashboard under **Environment**. See [`backend/.env.example`](backend/.env.example) for the full annotated list.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signing key for login tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `COOKIE_EXPIRES_IN` | Cookie lifetime in days, e.g. `7` |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Custom frontend domain, if you have one |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Image uploads |
| `EMAIL_HOST` / `_PORT` / `_USER` / `_PASS` | Contact form and newsletter |

### Which origins can call the API

`server.js` allows a request when **any** of these hold:

- it has no `Origin` header (curl, server-to-server, health checks)
- the origin ends in `.vercel.app` or `.netlify.app`
- the origin is `localhost` or `127.0.0.1` on any port
- the origin appears in `CLIENT_URL` (comma-separated for several)

So a fresh Vercel deploy works with no configuration. `CLIENT_URL` is only needed for a custom domain like `embs.kpriet.ac.in`.

> After changing `server.js`, redeploy on Render for the change to take effect.

---

## Using the admin panel

Visit `/admin` on the deployed site and log in with the admin password.

From there you can create, edit and delete: events, members, projects, blogs, podcasts, gallery images, achievements and announcements. Images uploaded here go to Cloudinary and the URL is stored in MongoDB.

Anything published in the admin panel appears on the public pages immediately, since those pages read from the same API on load.

---

## Adding demo content

Some sections start out empty. To fill them with realistic placeholder content:

```bash
cd backend
npm run seed:content          # DRY RUN — prints what it would do, changes nothing
npm run seed:content:apply    # actually writes
```

`seedContent.js` is deliberately cautious:

- it **only** inserts into collections that are already empty, so it can never duplicate or overwrite real content;
- it removes three specific leftover test events, and only after re-checking that each still matches the junk record it expects;
- it does nothing at all unless you pass `--apply`.

### A warning about `seed.js`

The older `backend/seed.js` is a **destructive reset**. It deletes every user, event and member before inserting its own fixtures — including the admin account. It now refuses to run without an explicit flag:

```bash
node seed.js --force    # only if you genuinely want to wipe and reset
```

Use `seedContent.js` for everyday content work.

---

## Troubleshooting

**Events and members are empty, and the browser console shows a CORS error.**
The API is rejecting the site's origin. Confirm the deployed URL ends in `.vercel.app`, or add it to `CLIENT_URL` on Render and redeploy.

**The first page load after a while takes 30–50 seconds.**
Render's free tier puts the API to sleep after 15 minutes of inactivity, and the next request wakes it. Everything after that is fast. Upgrading the Render plan is the only real fix.

**Opening a page directly from the file manager shows no content.**
Module scripts cannot load over `file://`. Serve the folder with `npx serve .` instead.

**Images uploaded in the admin panel do not appear.**
Check the three `CLOUDINARY_*` variables on Render. If the credentials are wrong, the upload fails silently and the record is saved without an image.

**Login fails with "Could not reach the server".**
The API is probably asleep or redeploying. Open `https://embs-website-89fl.onrender.com/api/health` directly and wait for it to return `{"success":true}`.

---

## Credits

Built by the IEEE EMBS Web Team, KPR Institute of Engineering and Technology.
