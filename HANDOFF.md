# Handover notes

Everything below is what you need to take full ownership of the site. It should
take about twenty minutes. Follow the steps in order, because step 3 depends on
step 1 having finished.

For how the project is structured and how to run it locally, see [README.md](README.md).

---

## Do these in order

### 1. Merge this pull request

Merging redeploys your Render backend automatically, and that deploy contains a
fix you need before anything else will work.

The API used to accept requests only from `*.netlify.app`. Any site hosted on
Vercel was rejected outright, so the pages would load but every piece of live
content would silently fail to appear. That is fixed in this branch.

**Wait for Render to finish deploying before moving on.** Check it worked:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Origin: https://test.vercel.app" \
  https://embs-website.onrender.com/api/health
```

- `200` means the fix is live, carry on
- `500` means Render has not picked it up yet. Wait a minute, or open your Render
  dashboard and hit **Manual Deploy → Deploy latest commit**

### 2. Point the site at your own backend

While the work was in progress the site was pointed at a temporary backend so it
could be tested. Change it back to yours.

Open [`config.js`](config.js) and edit line 10:

```js
// from
window.EMBS_API_BASE = 'https://embs-website-89fl.onrender.com/api';

// to
window.EMBS_API_BASE = 'https://embs-website.onrender.com/api';
```

That one line is the only place the backend address appears. It used to be
duplicated in 34 places across the HTML and JS, which is why it was moved here.

> **Do not do this before step 1 has finished deploying.** If you point the site
> at your backend while it is still running the old code, every page will load
> with no content and the cause is invisible unless you open the browser console.

Commit and push that change.

### 3. Deploy the site to Vercel

Free, and no card required.

1. Sign up at [vercel.com/signup](https://vercel.com/signup) with **the GitHub
   account that owns this repository**
2. **Add New → Project**, import `embs-website`
3. Settings:

   | Field | Value |
   | --- | --- |
   | Framework Preset | **Other** |
   | Root Directory | `./` |
   | Build Command | leave **empty** |
   | Output Directory | leave **empty** |
   | Install Command | leave **empty** |

   There is no build step. The HTML, CSS and JS are served exactly as they are.
4. Leave Environment Variables blank. The frontend has none.
5. **Deploy**

`vercel.json` in the repo handles caching, security headers and the `/admin`
route. Every push to `main` redeploys automatically after this.

### 4. Check it worked

Open your new Vercel URL and confirm:

- Events and Members show real content. This is the real test, it proves the
  frontend and backend are talking to each other
- The announcement ticker is scrolling along the top
- `/admin` shows the login page and you can log in
- Narrow the browser window until the hamburger menu appears, and open it

---

## Two things worth fixing when you have time

Neither stops the site working, but both are worth doing.

### Your credentials are in this repository

`backend/.env` was committed at some point, and this repository is public. That
means the MongoDB connection string, the JWT secret, the Cloudinary keys and the
email password are all readable by anyone who finds the repo.

Removing the file now does not help on its own, because it stays in the git
history. What actually fixes it is changing the credentials:

1. **MongoDB Atlas** → Database Access → edit the user → Edit Password
2. **Cloudinary** → Settings → Security → regenerate API secret
3. **JWT secret** → any long random string. Generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Changing this logs everyone out once, which is expected
4. **Email password** → generate a new Gmail App Password

Update all of them in the Render dashboard under **Environment**, then run
`git rm --cached backend/.env` and commit so it stops being tracked.

### The Google Maps key on the contact page is unrestricted

The key is in the page source, which is normal and unavoidable for a browser
key. The problem is that it currently accepts requests from any website, so
anyone can copy it and the usage bills to your Google Cloud account.

Fix it in Google Cloud Console → Credentials → your key → **Application
restrictions** → HTTP referrers, then add your Vercel domain.

---

## Things you should know about

**Duplicate member record.** Josephine Mary Carain appears twice in the members
list as Content Lead, plus a third partial entry as "Carain / Design Lead". I
left it alone rather than guess which is correct. Fix it in the admin panel
under Members.

**The logo says JUST Student Chapter.** The file is `logo-cropped.png` and it
carries another chapter's name while the rest of the site is branded KPRIET. It
was only compressed, not changed. Swap in the correct artwork when you have it,
keeping the same filename.

**Social links are hidden until you fill them in.** The footer and contact page
icons pointed nowhere, so rather than ship dead links they now read from
`window.EMBS_SOCIAL` in [`config.js`](config.js) and hide themselves when no URL
is set. Fill in the ones you have and they appear automatically.

**Announcements can carry an application link.** The featured announcement's
"Apply Now" button uses the `link` field if you set one, for example a Google
Form for recruitment. Without it the button goes to the contact page.

**The admin panel has not been checked for broken buttons.** Every public page
was audited automatically and has zero dead links, dead buttons or dead forms.
The admin pages could not be included because they need a login. Worth clicking
through them yourself once.

**Adding demo content.** If you ever need to repopulate empty sections:

```bash
cd backend
npm run seed:content          # preview only, changes nothing
npm run seed:content:apply    # actually writes
```

It only fills collections that are already empty, so it cannot overwrite real
content.

> **Careful with `npm run seed`.** That is a different script and it deletes every
> user, event and member before inserting its own fixtures, including your admin
> account. It now refuses to run without `--force`, but do not use it on the live
> database.
