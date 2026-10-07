// Seed data for the browser suite — written ONLY to the verified audit DB via
// env.dbWrite(). Everything is clearly labelled "Audit" test content.
import { breq } from './env.mjs';

const M = n => breq(`./models/${n}`);
const IMG = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
const IMG2 = 'https://res.cloudinary.com/demo/image/upload/dog.jpg';
const day = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };

/* Harmless probes: if any of these execute, they only record their own tag. */
export const X = tag => `Audit ${tag} <img src=x onerror="__x('${tag}')"><svg onload="__x('${tag}:svg')"></svg>`;
export const XU = tag => `javascript:__x('${tag}')`;
export const XB = tag => `${IMG}" onerror="__x('${tag}:attr')" data-a="`;

export async function seedRealistic(env) {
  return env.dbWrite(async () => {
    const out = {};
    for (const n of ['Event', 'Podcast', 'Blog', 'Member', 'Achievement', 'Announcement', 'Gallery', 'Project', 'TimelineEntry', 'Document', 'SiteSettings', 'Subscriber']) await M(n).deleteMany({});
    const Event = M('Event');
    out.events = await Event.insertMany([
      { title: 'Audit Workshop on Biosignals', type: 'Workshop', date: day(9), time: '10:00 AM', venue: 'Audit Lab 1', mode: 'offline', speaker: 'Dr. Audit Speaker', description: 'Hands-on audit workshop description.', tags: ['signals'], thumbnail: IMG, published: true, featured: true, status: 'upcoming', registrationLink: 'https://example.test/register' },
      { title: 'Audit Seminar on Imaging', type: 'Seminar', date: day(20), venue: 'Audit Hall', mode: 'hybrid', description: 'Seminar text.', thumbnail: IMG2, published: true, status: 'upcoming' },
      { title: 'Audit Hackathon 2031', type: 'Hackathon', date: day(35), mode: 'online', description: 'Hackathon text.', published: true, status: 'upcoming' },
      { title: 'Audit Guest Lecture Past', type: 'Guest Lecture', date: day(-30), venue: 'Audit Auditorium', description: 'Past lecture.', thumbnail: IMG, published: true, status: 'completed' },
      { title: 'Audit Competition Past', type: 'Competition', date: day(-60), description: 'Past competition.', published: true, status: 'completed' },
      { title: 'Audit Webinar Past', type: 'Webinar', date: day(-90), mode: 'online', published: true, status: 'completed' },
      { title: 'Audit Workshop Past', type: 'Workshop', date: day(-120), thumbnail: IMG2, published: true, status: 'completed' },
      { title: 'Audit Minimal Event', date: day(-10), published: true, status: 'completed' },
      { title: 'AUDIT-DRAFT-EVENT', type: 'Workshop', date: day(5), published: false, status: 'upcoming', featured: true },
    ]);
    out.podcasts = await M('Podcast').insertMany([
      { title: 'Audit Episode One', episodeNumber: 1, description: 'First audit episode about Artificial Intelligence.', duration: '32:10', guestName: 'Audit Guest A', guestDesignation: 'Researcher', spotifyUrl: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk', tags: ['Artificial Intelligence'], published: true, publishedAt: new Date(Date.now() - 3 * 864e5), thumbnail: IMG },
      { title: 'Audit Episode Two', episodeNumber: 2, description: 'Medical Imaging talk.', duration: '28:00', guestName: 'Audit Guest B', tags: ['Medical Imaging'], youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', published: true, publishedAt: new Date(Date.now() - 2 * 864e5) },
      { title: 'Audit Minimal Episode', episodeNumber: 3, published: true, publishedAt: new Date(Date.now() - 864e5) },
      { title: 'AUDIT-DRAFT-PODCAST', episodeNumber: 4, published: false },
    ]);
    out.blogs = await M('Blog').insertMany([
      { title: 'Audit Tutorial Post', content: 'Paragraph one of the audit tutorial.\n\nParagraph two.', excerpt: 'Audit tutorial excerpt', tags: ['Tutorials'], thumbnail: IMG, published: true, publishedAt: new Date(Date.now() - 5 * 864e5) },
      { title: 'Audit Event Report Post', content: 'Event report body.', tags: ['Event Reports'], published: true, publishedAt: new Date(Date.now() - 4 * 864e5) },
      { title: 'Audit Minimal Post', content: 'x', published: true, publishedAt: new Date(Date.now() - 864e5) },
      { title: 'AUDIT-DRAFT-BLOG', content: 'secret draft', published: false },
    ]);
    out.members = await M('Member').insertMany([
      { name: 'Audit Chair Person', role: 'Chairperson', batch: '2027', photo: IMG, linkedin: 'https://www.linkedin.com/in/example', order: 1, active: true, inOrgChart: true },
      { name: 'Audit Vice Chair', role: 'Vice Chairperson', batch: '2027', order: 2, active: true, inOrgChart: true },
      { name: 'Audit Secretary', role: 'Secretary', batch: '2028', order: 3, active: true, inOrgChart: true },
      { name: 'Audit Treasurer', role: 'Treasurer', order: 4, active: true, inOrgChart: true },
      { name: 'Audit Webmaster', role: 'Webmaster', github: 'https://github.com/example', order: 5, active: true },
      { name: 'Audit Member Six', role: 'Member', order: 6, active: true },
      { name: 'Audit Faculty Advisor', role: 'Faculty Advisor', bio: 'Audit advisor bio.', isFacultyAdvisor: true, isFacultyCoordinator: true, order: 7, active: true },
      { name: 'Audit Minimal Member', role: 'Member', order: 8, active: true },
      { name: 'AUDIT-DRAFT-MEMBER', role: 'Former', active: false, order: 9 },
    ]);
    out.achievements = await M('Achievement').insertMany([
      { title: 'Audit Student Award', category: 'Student Awards', description: 'Award text.', date: day(-40), featured: true, image: IMG },
      { title: 'Audit Publication', category: 'Publications', date: day(-80), featured: true },
      { title: 'Audit Competition Win', category: 'Competition Wins', date: day(-100), featured: true },
      { title: 'Audit Minimal Achievement', featured: true },
      { title: 'AUDIT-DRAFT-ACHIEVEMENT', featured: false },
    ]);
    out.announcements = await M('Announcement').insertMany([
      { title: 'Audit Internship Call', body: 'Apply for the audit internship.', category: 'internships', link: 'https://example.test/apply', expiresAt: new Date(Date.now() + 3 * 864e5) },
      { title: 'Audit Competition Notice', body: 'Competition notice body.', category: 'competitions', pinned: true },
      { title: 'Audit Scholarship', body: 'Scholarship body.', category: 'scholarships', showInUpdates: true },
      { title: 'Audit Minimal Notice', body: 'x' },
      { title: 'AUDIT-DRAFT-EXPIRED', body: 'expired', category: 'deadlines', expiresAt: new Date(Date.now() - 864e5) },
    ]);
    const ev = out.events;
    out.gallery = await M('Gallery').insertMany([
      { title: 'Audit Photo One', imageUrl: IMG, event: ev[0]._id, caption: 'Caption one', published: true, publishedAt: new Date() },
      { title: 'Audit Photo Two', imageUrl: IMG2, event: ev[3]._id, published: true, publishedAt: new Date() },
      { title: 'Audit Photo Three', imageUrl: IMG, event: ev[3]._id, published: true, publishedAt: new Date() },
      { title: 'Audit Minimal Photo', imageUrl: IMG2, published: true, publishedAt: new Date() },
      { title: 'Audit Video', type: 'video', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', published: true, publishedAt: new Date() },
      { title: 'AUDIT-DRAFT-GALLERY', imageUrl: IMG, published: false },
    ]);
    out.projects = await M('Project').insertMany([
      { title: 'Audit ECG Classifier', category: 'AI Healthcare', description: 'Audit project description.', status: 'ongoing', mentor: 'Dr. Audit', teamMembers: ['Audit Student A', 'Audit Student B'], tags: ['AI Healthcare', 'python'], repoUrl: 'https://github.com/example/repo', thumbnail: IMG, featured: true, visibility: 'visible', showInUpdates: true },
      { title: 'Audit Imaging Toolkit', category: 'Medical Imaging', status: 'completed', featured: true, visibility: 'visible' },
      { title: 'Audit Minimal Project', featured: true, visibility: 'visible' },
      { title: 'AUDIT-DRAFT-PROJECT', featured: false, visibility: 'hidden' },
    ]);
    out.timeline = await M('TimelineEntry').insertMany([
      { year: '2019', title: 'Audit Chapter Founded', description: 'Founding text.', order: 1 },
      { year: '2023', title: 'Audit Milestone', order: 2 },
      { year: '2099', title: 'AUDIT-DRAFT-TIMELINE', active: false, order: 3 },
    ]);
    out.documents = await M('Document').insertMany([
      { title: 'Audit Chapter Brochure', fileUrl: 'https://example.test/brochure.pdf', category: 'brochure' },
      { title: 'AUDIT-DRAFT-DOCUMENT', fileUrl: 'https://example.test/private.pdf', public: false },
    ]);
    out.subscribers = await M('Subscriber').create([{ email: 'audit-reader@example.test' }]);
    out.settings = await M('SiteSettings').create({
      siteName: 'IEEE EMBS Audit Chapter', institution: 'Audit Institute', officialEmail: 'chapter@example.test', phone: '+91 00000 00000',
      address: 'Audit Campus, Audit City', facultyContact: 'Dr. Audit Faculty', footerText: 'Audit footer text', chapterDescription: 'Audit chapter description.',
      vision: 'Audit vision.', mission: 'Audit mission.', establishedYear: '2019', galleryFeaturedHeading: 'Audit Featured', galleryFeaturedDesc: 'Audit featured desc',
      socialLinks: { linkedin: 'https://www.linkedin.com/company/example', instagram: 'https://www.instagram.com/example', youtube: '', spotify: 'https://open.spotify.com/show/example', x: '', facebook: '' },
      registrationLinks: { membership: 'https://example.test/join' }, brochureLinks: {},
    });
    return out;
  });
}

/* XSS layer: one record per type with a probe in every text/URL field, plus
   settings fields. Run after seedRealistic. */
export async function seedXss(env) {
  return env.dbWrite(async () => {
    const out = {};
    out.event = await M('Event').create({ title: X('event.title'), type: X('event.type'), date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), time: X('event.time'), venue: X('event.venue'), speaker: X('event.speaker'), description: X('event.description'), tags: [X('event.tag')], thumbnail: XB('event.thumbnail'), speakerPhoto: XB('event.speakerPhoto'), registrationLink: XU('event.registrationLink'), published: true, featured: true, status: 'upcoming', showInUpdates: true });
    out.eventPast = await M('Event').create({ title: X('eventPast.title'), type: X('eventPast.type'), date: '2001-02-03', venue: X('eventPast.venue'), description: X('eventPast.description'), thumbnail: XB('eventPast.thumbnail'), registrationLink: XU('eventPast.registrationLink'), published: true, status: 'completed' });
    out.podcast = await M('Podcast').create({ title: X('podcast.title'), episodeNumber: 99, description: X('podcast.description'), duration: X('podcast.duration'), guestName: X('podcast.guestName'), guestDesignation: X('podcast.guestDesignation'), thumbnail: XB('podcast.thumbnail'), spotifyUrl: XU('podcast.spotifyUrl'), youtubeUrl: XU('podcast.youtubeUrl'), audioUrl: XU('podcast.audioUrl'), tags: [X('podcast.tag')], published: true, publishedAt: new Date(), showInUpdates: true });
    out.blog = await M('Blog').create({ title: X('blog.title'), content: X('blog.content') + '\n\n' + X('blog.content2'), excerpt: X('blog.excerpt'), tags: [X('blog.tag')], thumbnail: XB('blog.thumbnail'), published: true, publishedAt: new Date(), showInUpdates: true });
    out.member = await M('Member').create({ name: X('member.name'), role: X('member.role'), batch: X('member.batch'), photo: XB('member.photo'), linkedin: XU('member.linkedin'), github: XU('member.github'), email: X('member.email'), bio: X('member.bio'), order: 0, active: true, inOrgChart: true, isFacultyAdvisor: true, isFacultyCoordinator: true });
    out.achievement = await M('Achievement').create({ title: X('achievement.title'), description: X('achievement.description'), category: X('achievement.category'), date: X('achievement.date'), image: XB('achievement.image'), featured: true, showInUpdates: true });
    out.announcement = await M('Announcement').create({ title: X('announcement.title'), body: X('announcement.body'), link: XU('announcement.link'), attachmentUrl: XU('announcement.attachmentUrl'), category: 'workshops', pinned: true, expiresAt: new Date(Date.now() + 864e5), showInUpdates: true });
    out.gallery = await M('Gallery').create({ title: X('gallery.title'), caption: X('gallery.caption'), imageUrl: XB('gallery.imageUrl'), event: out.event._id, published: true, publishedAt: new Date() });
    out.video = await M('Gallery').create({ title: X('video.title'), type: 'video', videoUrl: XU('video.videoUrl'), caption: X('video.caption'), published: true, publishedAt: new Date() });
    out.project = await M('Project').create({ title: X('project.title'), description: X('project.description'), category: X('project.category'), mentor: X('project.mentor'), teamMembers: [X('project.team')], tags: [X('project.tag')], repoUrl: XU('project.repoUrl'), liveUrl: XU('project.liveUrl'), paperUrl: XU('project.paperUrl'), thumbnail: XB('project.thumbnail'), featured: true, visibility: 'visible', showInUpdates: true });
    out.timeline = await M('TimelineEntry').create({ year: X('timeline.year'), title: X('timeline.title'), description: X('timeline.description'), order: 0 });
    // legacy rows that pre-date the stricter email check (written straight to the audit DB)
    await M('Subscriber').collection.insertMany([
      { email: `<img src=x onerror="__x('subscriber.email')">@a.co`, createdAt: new Date() },
      { email: `x'-__x('subscriber.onclick')-'@example.test`, createdAt: new Date() },
    ]);
    out.document = await M('Document').create({ title: X('document.title'), description: X('document.description'), fileUrl: XU('document.fileUrl'), originalFilename: X('document.filename') });
    await M('SiteSettings').updateOne({}, { $set: {
      footerText: X('settings.footerText'), address: X('settings.address'), facultyContact: X('settings.facultyContact'), phone: X('settings.phone'),
      officialEmail: X('settings.officialEmail'), chapterDescription: X('settings.chapterDescription'), vision: X('settings.vision'), mission: X('settings.mission'),
      institution: X('settings.institution'), galleryFeaturedHeading: X('settings.galleryHeading'), galleryFeaturedDesc: X('settings.galleryDesc'),
      mapUrl: XU('settings.mapUrl'), logoUrl: XB('settings.logoUrl'), podcastCoverUrl: XB('settings.podcastCoverUrl'), blogHeroImageUrl: XB('settings.blogHero'),
      membersHeroImageUrl: XB('settings.membersHero'), aboutHeroImageUrl: XB('settings.aboutHero'), projectsHeroImageUrl: XB('settings.projectsHero'), activitiesHeroImageUrl: XB('settings.activitiesHero'),
      'socialLinks.linkedin': XU('settings.linkedin'), 'socialLinks.instagram': XU('settings.instagram'), 'socialLinks.spotify': XU('settings.spotify'), 'socialLinks.youtube': XU('settings.youtube'),
      'registrationLinks.membership': XU('settings.membershipLink'), 'registrationLinks.events': XU('settings.eventsLink'), 'brochureLinks.chapter': XU('settings.brochure'),
    } });
    return out;
  });
}
