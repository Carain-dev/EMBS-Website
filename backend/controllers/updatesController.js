const asyncHandler  = require('express-async-handler');
const Event         = require('../models/Event');
const Blog          = require('../models/Blog');
const Project       = require('../models/Project');
const Podcast       = require('../models/Podcast');
const Achievement   = require('../models/Achievement');
const Announcement  = require('../models/Announcement');
const { sendResponse } = require('../utils/sendResponse');

/*
 * GET /api/updates
 *
 * Returns a normalised list of all CMS items that are:
 *   1. showInUpdates: true
 *   2. Publicly visible according to each model's own rules
 *
 * Normalised shape:
 *   { title, type, url, date }
 *
 * Sorted: pinned Announcements first, then by date descending.
 * Only public-safe fields are exposed — no admin credentials, drafts, etc.
 */
exports.getUpdates = asyncHandler(async (req, res) => {

  /* Run all 6 queries in parallel for speed */
  const [events, blogs, projects, podcasts, achievements, announcements] =
    await Promise.all([
      /* Events: must be published */
      Event.find({ showInUpdates: true, published: true })
        .select('title date createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      /* Blogs: must be published */
      Blog.find({ showInUpdates: true, published: true })
        .select('title publishedAt createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      /* Projects: visibility must not be hidden */
      Project.find({ showInUpdates: true, visibility: { $ne: 'hidden' } })
        .select('title createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      /* Podcasts: must be published */
      Podcast.find({ showInUpdates: true, published: true })
        .select('title episodeNumber createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      /* Achievements: all achievements with showInUpdates are treated as public
         (Achievement has no published field — featured controls homepage display,
         which is separate from updates) */
      Achievement.find({ showInUpdates: true })
        .select('title date createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      /* Announcements: not expired (expiresAt null OR in the future) */
      Announcement.find({
        showInUpdates: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .select('title pinned createdAt')
        .sort({ pinned: -1, createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

  /* Normalise each group into the common shape */
  const normalize = (items, type, urlFn, labelFn) =>
    items.map(item => ({
      title:  labelFn ? labelFn(item) : item.title,
      type,
      url:    urlFn(item),
      date:   item.createdAt,
      pinned: item.pinned || false,
    }));

  const all = [
    ...normalize(events,       'event',        e  => `event.html?id=${e._id}`,
      e  => `New Event: ${e.title}`),
    ...normalize(blogs,        'blog',         b  => `post.html?id=${b._id}`,
      b  => `New Article: ${b.title}`),
    ...normalize(projects,     'project',      p  => `project.html?id=${p._id}`,
      p  => `New Project: ${p.title}`),
    ...normalize(podcasts,     'podcast',      () => 'podcast.html',
      p  => `New Episode: ${p.title}`),
    ...normalize(achievements, 'achievement',  () => 'achievements.html',
      a  => `Achievement: ${a.title}`),
    ...normalize(announcements,'announcement', () => 'announcements.html',
      a  => a.title),   /* announcements: show title as-is, no prefix */
  ];

  /* Sort: pinned items first, then by date descending */
  all.sort((a, b) => {
    if (b.pinned !== a.pinned) return b.pinned ? 1 : -1;
    return new Date(b.date) - new Date(a.date);
  });

  sendResponse(res, 200, all, 'Success');
});
