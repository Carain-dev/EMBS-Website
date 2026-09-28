const asyncHandler  = require('express-async-handler');
const Member        = require('../models/Member');
const Event         = require('../models/Event');
const Podcast       = require('../models/Podcast');
const Blog          = require('../models/Blog');
const Achievement   = require('../models/Achievement');
const Gallery       = require('../models/Gallery');
const Project       = require('../models/Project');
const Announcement  = require('../models/Announcement');
const { sendResponse } = require('../utils/sendResponse');

exports.getStats = asyncHandler(async (req, res) => {
  const now       = new Date();
  const year      = now.getFullYear();
  const monthStart = new Date(year, now.getMonth(), 1);

  /* ── Member stats ─────────────────────────── */
  const membersTotal    = await Member.countDocuments({ active: true });
  const membersThisMonth = await Member.countDocuments({
    active: true,
    createdAt: { $gte: monthStart },
  });

  /* ── Event stats ──────────────────────────── */
  const eventsTotal    = await Event.countDocuments({});
  const eventsUpcoming = await Event.countDocuments({ status: 'upcoming' });

  /* Events per month for the current year — one aggregation */
  const eventsMonthly = await Event.aggregate([
    {
      $match: {
        date: {
          $gte: `${year}-01-01`,
          $lte: `${year}-12-31`,
        },
      },
    },
    {
      $group: {
        _id: { $substr: ['$date', 5, 2] }, /* "MM" from "YYYY-MM-DD" */
        count: { $sum: 1 },
      },
    },
  ]);

  /* Build a 12-element array (index 0 = Jan … 11 = Dec) */
  const monthly = Array(12).fill(0);
  eventsMonthly.forEach(({ _id, count }) => {
    const idx = parseInt(_id, 10) - 1;
    if (idx >= 0 && idx < 12) monthly[idx] = count;
  });

  /* ── Podcast stats ────────────────────────── */
  const podcastsTotal    = await Podcast.countDocuments({ published: true });
  const podcastsThisMonth = await Podcast.countDocuments({
    published: true,
    createdAt: { $gte: monthStart },
  });

  /* ── Pending Approvals ────────────────────── */
  /* There is NO approval workflow in this project.
     The closest truthful alternative: unpublished Events + Blogs + Achievements.
     These represent content that exists but is not yet publicly visible —
     the admin may want to review and publish them.                         */
  const unpublishedEvents       = await Event.countDocuments({ published: false });
  const unpublishedBlogs        = await Blog.countDocuments({ published: false });
  const unpublishedAchievements = await Achievement.countDocuments({ featured: false });
  const pendingReview = unpublishedEvents + unpublishedBlogs;
  /* Note: unpublishedAchievements excluded — a non-featured achievement is
     intentional, not "pending". Only truly unpublished content is surfaced. */

  /* ── Recent Activity (up to 8 items across collections) ────────────── */
  const LIMIT = 8;

  /* Fetch recent records from each collection concurrently */
  const [recentMembers, recentEvents, recentPodcasts, recentBlogs,
         recentAchievements, recentGallery, recentProjects, recentAnnouncements] =
    await Promise.all([
      Member.find({ active: true }).sort({ createdAt: -1 }).limit(LIMIT).select('name createdAt').lean(),
      Event.find({}).sort({ createdAt: -1 }).limit(LIMIT).select('title published createdAt').lean(),
      Podcast.find({ published: true }).sort({ createdAt: -1 }).limit(LIMIT).select('title episodeNumber createdAt').lean(),
      Blog.find({}).sort({ createdAt: -1 }).limit(LIMIT).select('title published createdAt').lean(),
      Achievement.find({ featured: true }).sort({ createdAt: -1 }).limit(LIMIT).select('title createdAt').lean(),
      Gallery.find({ published: true }).sort({ createdAt: -1 }).limit(LIMIT).select('title createdAt').lean(),
      Project.find({}).sort({ createdAt: -1 }).limit(LIMIT).select('title createdAt').lean(),
      Announcement.find({}).sort({ createdAt: -1 }).limit(LIMIT).select('title createdAt').lean(),
    ]);

  /* Normalise into a common shape */
  const activities = [
    ...recentMembers.map(r => ({ text: `New member ${r.name} joined`, color: 'teal', ts: r.createdAt })),
    ...recentEvents.map(r => ({ text: `Event "${r.title}" ${r.published ? 'published' : 'saved as draft'}`, color: 'purple', ts: r.createdAt })),
    ...recentPodcasts.map(r => ({ text: `Podcast EP ${r.episodeNumber} "${r.title}" added`, color: 'teal', ts: r.createdAt })),
    ...recentBlogs.map(r => ({ text: `Blog "${r.title}" ${r.published ? 'published' : 'saved as draft'}`, color: r.published ? 'purple' : 'amber', ts: r.createdAt })),
    ...recentAchievements.map(r => ({ text: `Achievement "${r.title}" added`, color: 'purple', ts: r.createdAt })),
    ...recentGallery.map(r => ({ text: `Gallery item "${r.title}" published`, color: 'teal', ts: r.createdAt })),
    ...recentProjects.map(r => ({ text: `Project "${r.title}" updated`, color: 'purple', ts: r.createdAt })),
    ...recentAnnouncements.map(r => ({ text: `Announcement "${r.title}" posted`, color: 'amber', ts: r.createdAt })),
  ];

  /* Sort by timestamp descending, take the 8 most recent */
  activities.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const recentActivity = activities.slice(0, LIMIT);

  sendResponse(res, 200, {
    members:  { total: membersTotal, thisMonth: membersThisMonth },
    events:   { total: eventsTotal,  upcoming: eventsUpcoming, monthly, year },
    podcasts: { total: podcastsTotal, thisMonth: podcastsThisMonth },
    pending:  { review: pendingReview },
    recentActivity,
  });
});
