/* ════════════════════════════════════════════════════════════════
   seedContent.js — safe, additive content seeder + junk cleanup

   Unlike seed.js (which calls deleteMany and wipes Users/Events/Members),
   this script never destroys real data:

     • It only inserts into collections that are already EMPTY.
     • It only deletes three specific test events, and only after
       re-checking that each one still looks like the junk record.
     • It runs as a DRY RUN unless you pass --apply.

   Usage:
     node seedContent.js              # preview, changes nothing
     node seedContent.js --apply      # actually write
     node seedContent.js --apply --seed-only
     node seedContent.js --apply --clean-only
   ════════════════════════════════════════════════════════════════ */

require('dotenv').config();

const mongoose = require('mongoose');

const User         = require('./models/User');
const Event        = require('./models/Event');
const Blog         = require('./models/Blog');
const Podcast      = require('./models/Podcast');
const Project      = require('./models/Project');
const Achievement  = require('./models/Achievement');
const Announcement = require('./models/Announcement');

const argv      = process.argv.slice(2);
const APPLY     = argv.includes('--apply');
const SEED_ONLY = argv.includes('--seed-only');
const CLEAN_ONLY= argv.includes('--clean-only');

/* ── Junk events created while testing the admin panel ──────────
   Each entry records what we expect to find. If the stored document
   no longer matches, we skip it rather than delete the wrong thing. */
const JUNK_EVENTS = [
  { _id: '6a68bedb8f1924249c1ab586', title: 'BioTech Innovation Summit', description: 'dhiyihfbiuyefohfouyotuhoutyoth' },
  { _id: '6a68beb08f1924249c1ab57f', title: 'BioTech Innovation Summit', description: '' },
  { _id: '6a68be338f1924249c1ab55e', title: 'BioTech Innovation Summit', description: 'dhidhfuhieufhqeiufhiqufiuefhefhoeufqofqeoufhoqufhqohfo' },
];

/* The announcements collection holds eight keyboard-mash records from the same
   testing session. They are all past their expiry date, so the API filters
   them out and both the ticker and the announcements page render empty.
   Clearing them lets the collection seed like the other empty ones. */
const JUNK_ANNOUNCEMENTS = [
  { _id: '6a68b1f68f1924249c1ab52a', title: 'jdldjljfl' },
  { _id: '6a68bf9a8f1924249c1ab5a8', title: 'jdldjljfl' },
  { _id: '6a68c0008f1924249c1ab5ae', title: 'chjbdcbjcnjc' },
  { _id: '6a68c00e8f1924249c1ab5b7', title: 'jdldjljfl' },
  { _id: '6a68c00e8f1924249c1ab5b9', title: 'jdldjljfl' },
  { _id: '6a68c00e8f1924249c1ab5bd', title: 'jdldjljfl' },
  { _id: '6a68c00e8f1924249c1ab5bf', title: 'jdldjljfl' },
  { _id: '6a68c0bf8f1924249c1ab5d3', title: 'fhfuhofuhouhotihtoi' },
];

/* ── Demo content ───────────────────────────────────────────── */

const blogs = [
  {
    title: 'Why Biomedical Signal Processing Matters More Than Ever',
    excerpt: 'ECG, EEG and EMG signals carry more clinical information than most people realise. Here is why the field is having a moment.',
    content: `Every heartbeat leaves a trace. So does every muscle contraction and every burst of cortical activity. Biomedical signal processing is the discipline that turns those traces into something a clinician can act on.

For a long time the bottleneck was hardware. Recording a clean twelve-lead ECG meant a room full of equipment and a trained technician. That is no longer true. A modern analog front-end costs a few hundred rupees and fits on a board smaller than a matchbox, which means the interesting problems have shifted from acquisition to interpretation.

That shift is where students can contribute. Filtering baseline wander out of an ECG, rejecting powerline interference at 50 Hz, segmenting the QRS complex, these are well-defined problems with public datasets and decades of literature behind them. You can reproduce a published result in an afternoon and then start asking what happens when the signal is noisier than the paper assumed.

If you want a starting point, the MIT-BIH Arrhythmia Database is free, well documented, and small enough to work with on a laptop. Load a record, plot it, and try to find the R peaks by hand before you write any code. Understanding what the signal actually looks like will save you a great deal of debugging later.`,
    tags: ['signal processing', 'ECG', 'getting started'],
    published: true,
    publishedAt: new Date('2026-05-18'),
  },
  {
    title: "A Student's Guide to Medical Image Segmentation",
    excerpt: 'Segmentation sounds intimidating until you realise it is mostly careful data handling plus one well-understood architecture.',
    content: `Medical image segmentation is the task of labelling every pixel in a scan. Tumour or not tumour. Vessel or background. It is the foundation of a surprising amount of clinical software, and it is one of the more approachable entry points into medical imaging research.

The architecture most people reach for is U-Net, and for good reason. It was designed for biomedical images specifically, it trains on modest datasets, and the encoder-decoder structure with skip connections is easy to reason about. You do not need a cluster of GPUs to get a sensible result on a 2D slice.

What trips students up is rarely the model. It is the data. Medical scans arrive as DICOM files with inconsistent orientations, varying slice thicknesses, and intensity ranges that differ between machines. Normalising all of that is unglamorous work, and skipping it is the fastest way to a model that scores well on your validation split and fails on anything real.

A practical tip: hold out an entire patient, not just random slices. Slices from the same scan are highly correlated, so a random split will leak information and flatter your results enormously. Split by patient and your numbers will drop. That drop is the honest number.`,
    tags: ['medical imaging', 'deep learning', 'U-Net'],
    published: true,
    publishedAt: new Date('2026-06-27'),
  },
  {
    title: 'Inside Our First Hackathon: Building a Low-Cost Pulse Oximeter',
    excerpt: 'Twenty-eight hours, nine teams, and a working SpO2 prototype built for under a thousand rupees.',
    content: `We ran our first internal hackathon in February with a deliberately narrow brief: build something that measures a real physiological parameter, and keep the bill of materials under one thousand rupees.

Nine teams entered. Six finished. The winning entry was a reflectance pulse oximeter built around a MAX30102 sensor and an ESP32, streaming SpO2 and heart rate to a phone over Bluetooth Low Energy.

The interesting part was not the hardware, which is fairly standard, but the calibration. Raw red and infrared absorbance ratios do not map to oxygen saturation without a calibration curve, and the published curves assume a specific sensor geometry. The team ended up collecting their own reference data against a commercial unit and fitting a simple quadratic. It is not clinical grade and nobody claimed it was, but the reasoning was sound and documented.

Two lessons carried over into how we run things now. First, a hard cost ceiling forces better engineering than an open budget does. Second, teams that spent the first two hours reading datasheets finished ahead of teams that spent them writing code.`,
    tags: ['hackathon', 'hardware', 'pulse oximetry'],
    published: true,
    publishedAt: new Date('2026-03-02'),
  },
];

const podcasts = [
  {
    title: 'Engineering the Human Heart',
    episodeNumber: 1,
    description: 'A conversation about cardiac device design, why regulatory approval takes years, and what biomedical engineering students routinely underestimate about the field.',
    duration: '38:14',
    guestName: 'Dr. Allwyn Gnanadas',
    guestDesignation: 'Professor, Biomedical Engineering, KPRIET',
    publishedAt: '2026-04-12',
  },
  {
    title: 'From Lab Bench to Bedside',
    episodeNumber: 2,
    description: 'How a research prototype becomes a product patients actually use, and the long, unglamorous validation work that happens in between.',
    duration: '44:02',
    guestName: 'Dr. Priya Nair',
    guestDesignation: 'Clinical Research Lead, Medical Imaging',
    publishedAt: '2026-05-24',
  },
  {
    title: 'Careers in Biomedical Engineering',
    episodeNumber: 3,
    description: 'Industry, higher study, or a startup? Three alumni talk honestly about the paths they took after graduating and what they would do differently.',
    duration: '51:37',
    guestName: 'EMBS Alumni Panel',
    guestDesignation: 'Class of 2021 and 2022',
    publishedAt: '2026-07-08',
  },
];

const projects = [
  {
    title: 'Smart ECG Arrhythmia Detector',
    description: 'A convolutional model trained on the MIT-BIH Arrhythmia Database to classify five beat types from single-lead ECG. The inference pipeline runs on a Raspberry Pi 4, making it usable as a screening aid where a full diagnostic setup is not available.',
    category: 'AI in Healthcare',
    status: 'completed',
    mentor: 'Dr. Allwyn Gnanadas',
    teamMembers: ['Arun Kumar', 'Priya Sundaram', 'Karthik Raman'],
    tags: ['Deep Learning', 'ECG', 'Edge Computing'],
    featured: true,
  },
  {
    title: 'Low-Cost Portable Pulse Oximeter',
    description: 'A reflectance pulse oximeter built around the MAX30102 sensor and an ESP32, streaming SpO2 and heart rate over Bluetooth Low Energy. Calibrated against a commercial reference unit, with the full bill of materials kept under one thousand rupees.',
    category: 'Biomedical Devices',
    status: 'completed',
    mentor: 'Dr. Meera Subramanian',
    teamMembers: ['Divya Krishnan', 'Sanjay Varma'],
    tags: ['Embedded Systems', 'SpO2', 'BLE'],
    featured: true,
  },
  {
    title: 'Brain Tumour Segmentation from MRI',
    description: 'A U-Net variant for segmenting glioma sub-regions on the BraTS dataset. The work focuses on honest evaluation: splits are held out by patient rather than by slice, which lowers the headline score but makes it meaningful.',
    category: 'Medical Imaging',
    status: 'ongoing',
    mentor: 'Dr. Priya Nair',
    teamMembers: ['Nandhini Prakash', 'Vishal Menon', 'Aisha Rahman'],
    tags: ['U-Net', 'MRI', 'Segmentation'],
    featured: false,
  },
  {
    title: 'EMG-Controlled Prosthetic Hand',
    description: 'A three-degree-of-freedom prosthetic hand actuated by surface EMG signals from the forearm. Gesture classification runs on-device, and the hand itself is 3D printed so the design can be reproduced cheaply.',
    category: 'Rehabilitation Engineering',
    status: 'ongoing',
    mentor: 'Dr. Ramesh Iyer',
    teamMembers: ['Karthik Selvam', 'Lakshmi Narayanan'],
    tags: ['EMG', '3D Printing', 'Prosthetics'],
    featured: false,
  },
  {
    title: 'Wearable Fall Detection Band for Elderly Care',
    description: 'A wrist-worn band that distinguishes genuine falls from ordinary activity using accelerometer and gyroscope data, then raises an alert to a paired caregiver phone. Tuned to keep false alarms low, since a band that cries wolf gets taken off.',
    category: 'Wearables & IoT',
    status: 'completed',
    mentor: 'Dr. Meera Subramanian',
    teamMembers: ['Sneha Ravi', 'Gokul Anand', 'Fathima Noor'],
    tags: ['IMU', 'Wearables', 'Elderly Care'],
    featured: false,
  },
];

const achievements = [
  {
    title: 'Outstanding Student Chapter Award',
    description: 'Recognised by the IEEE EMBS Madras Section for consistent technical activity, outreach, and membership growth through the 2025 to 2026 term.',
    date: '2026-06-20',
    category: 'Chapter Award',
    featured: true,
  },
  {
    title: 'First Place, National Biomedical Innovation Hackathon',
    description: 'A four-member team placed first among sixty-two entries for a low-cost neonatal jaundice screening device built over a thirty-six hour build window.',
    date: '2026-02-15',
    category: 'Competition',
    featured: true,
  },
  {
    title: 'Paper Accepted at IEEE EMBC',
    description: 'Chapter research on edge-deployable arrhythmia classification was accepted for poster presentation at the IEEE Engineering in Medicine and Biology Conference.',
    date: '2026-04-30',
    category: 'Publication',
    featured: false,
  },
  {
    title: 'Crossed 300 Active Student Members',
    description: 'The chapter passed three hundred active members across all four years of the programme, up from ninety-four at the time of inauguration in 2024.',
    date: '2026-01-10',
    category: 'Milestone',
    featured: false,
  },
];

const announcements = [
  {
    title: 'Recruitment open for the 2026 to 2027 core team',
    body: 'Applications are open for all core team positions including technical, design, editorial, and outreach roles. First and second year students are especially encouraged to apply. Applications close at the end of the month.',
    pinned: true,
    expiresAt: new Date('2026-12-31'),
  },
  {
    title: 'Medical Imaging Workshop registrations are live',
    body: 'A hands-on session covering MRI and CT preprocessing, segmentation, and evaluation. Laptops required. Seats are limited and allocated in registration order.',
    pinned: false,
    expiresAt: new Date('2026-12-31'),
  },
  {
    title: 'EMBS Podcast episode three is out now',
    body: 'Three alumni discuss industry, higher study, and startup paths after a biomedical engineering degree. Listen on the podcast page.',
    pinned: false,
    expiresAt: new Date('2026-12-31'),
  },
];

/* ── Helpers ────────────────────────────────────────────────── */

const log = (...args) => console.log(...args);

/* On a dry run nothing is actually deleted, so a collection that the cleanup
   step would empty still reports its old count. Subtracting the pending
   removals keeps the preview honest about what --apply would do. */
const pendingRemovals = {};

async function seedIfEmpty(Model, label, docs) {
  const stored = await Model.countDocuments();
  const existing = APPLY ? stored : stored - (pendingRemovals[label] || 0);

  if (existing > 0) {
    log(`  SKIP  ${label.padEnd(14)} already has ${existing} document(s) — left untouched`);
    return 0;
  }

  if (!APPLY) {
    log(`  WOULD ${label.padEnd(14)} insert ${docs.length} document(s)`);
    return docs.length;
  }

  await Model.insertMany(docs);
  log(`  OK    ${label.padEnd(14)} inserted ${docs.length} document(s)`);
  return docs.length;
}

/* Deletes the listed records, but only after re-checking that each one still
   matches the fields we recorded. If the content changed since this script was
   written we skip it rather than risk deleting something real. */
async function cleanJunk(Model, label, expectedDocs, extraCheck) {
  log(`\nCleaning up test ${label}`);
  let removed = 0;

  for (const expected of expectedDocs) {
    const doc = await Model.findById(expected._id);

    if (!doc) {
      log(`  SKIP  ${expected._id} — not found (already removed?)`);
      continue;
    }

    const matches = doc.title === expected.title &&
                    (extraCheck ? extraCheck(doc, expected) : true);

    if (!matches) {
      log(`  SKIP  ${expected._id} — content changed since this script was written, not deleting`);
      log(`        title=${JSON.stringify(doc.title)}`);
      continue;
    }

    if (!APPLY) {
      log(`  WOULD delete ${expected._id} — "${doc.title}"`);
      removed++;
      continue;
    }

    await Model.deleteOne({ _id: expected._id });
    log(`  OK    deleted ${expected._id} — "${doc.title}"`);
    removed++;
  }

  pendingRemovals[label] = removed;

  const left = await Model.countDocuments();
  log(`  ${removed} test ${label} ${APPLY ? 'removed' : 'would be removed'}; ${APPLY ? left : left - removed} would remain`);
  return removed;
}

async function cleanAllJunk() {
  await cleanJunk(Event, 'events', JUNK_EVENTS,
    (doc, expected) => (doc.description || '') === expected.description);
  await cleanJunk(Announcement, 'announcements', JUNK_ANNOUNCEMENTS);
}

async function seedContent() {
  log('\nSeeding empty collections');

  // Attach the admin user as blog author when one exists.
  const admin = await User.findOne({ role: 'admin' }).select('_id');
  const blogDocs = admin ? blogs.map(b => ({ ...b, author: admin._id })) : blogs;
  if (!admin) log('  NOTE  no admin user found — blogs will be seeded without an author');

  await seedIfEmpty(Blog,         'blogs',         blogDocs);
  await seedIfEmpty(Podcast,      'podcasts',      podcasts);
  await seedIfEmpty(Project,      'projects',      projects);
  await seedIfEmpty(Achievement,  'achievements',  achievements);
  await seedIfEmpty(Announcement, 'announcements', announcements);
}

/* ── Main ───────────────────────────────────────────────────── */

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Run this from the backend folder with a .env file present.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('MongoDB connected');
    log(APPLY
      ? '\n*** APPLY MODE — changes will be written ***'
      : '\n*** DRY RUN — nothing will be changed. Re-run with --apply to write. ***');

    /* Cleanup runs first on purpose: the announcements collection is entirely
       junk, and it has to be emptied before the seeder will populate it. */
    if (!SEED_ONLY)  await cleanAllJunk();
    if (!CLEAN_ONLY) await seedContent();

    log(APPLY ? '\nDone.' : '\nDry run complete. Re-run with --apply to make these changes.');
  } catch (err) {
    console.error('\nFailed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
