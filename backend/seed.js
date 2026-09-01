require('dotenv').config();

const mongoose = require('mongoose');
const User     = require('./models/User');
const Event    = require('./models/Event');
const Member   = require('./models/Member');

/* ── Seed Data ───────────────────────────────── */

const users = [
  {
    name:     'EMBS Admin',
    email:    'admin@ieeoembs.com',
    password: 'Admin@1234',
    role:     'admin',
  },
];

const events = [
  {
    title:       'BioTech Innovation Summit',
    type:        'conference',
    date:        '2025-09-15',
    venue:       'KPRIET Auditorium',
    mode:        'offline',
    speaker:     'Dr. Arun Kumar',
    description: 'Annual biomedical engineering summit featuring research presentations and workshops.',
    tags:        ['biomedical', 'innovation', 'research'],
    status:      'upcoming',
    featured:    true,
  },
  {
    title:       'Medical Imaging Workshop',
    type:        'workshop',
    date:        '2025-08-10',
    venue:       'Online',
    mode:        'online',
    speaker:     'Dr. Priya Nair',
    description: 'Hands-on workshop on MRI and CT scan image processing techniques.',
    tags:        ['imaging', 'workshop', 'MRI'],
    status:      'upcoming',
    featured:    false,
  },
  {
    title:       'IEEE EMBS Inauguration 2024',
    type:        'ceremony',
    date:        '2024-08-01',
    venue:       'KPRIET Seminar Hall',
    mode:        'offline',
    description: 'Official inauguration of the IEEE EMBS Student Chapter at KPRIET.',
    tags:        ['inauguration', 'IEEE'],
    status:      'completed',
    featured:    false,
  },
];

const members = [
  {
    name:     'Arjun Ramesh',
    role:     'Chairperson',
    batch:    '2022-2026',
    linkedin: 'https://linkedin.com',
    order:    1,
    active:   true,
  },
  {
    name:     'Divya Krishnan',
    role:     'Vice Chairperson',
    batch:    '2022-2026',
    linkedin: 'https://linkedin.com',
    order:    2,
    active:   true,
  },
  {
    name:     'Karthik Selvam',
    role:     'Secretary',
    batch:    '2023-2027',
    linkedin: 'https://linkedin.com',
    order:    3,
    active:   true,
  },
];

/* ── Seeder ──────────────────────────────────── */

const seed = async () => {
  /* This script DELETES every user, event and member before inserting.
     On a live database that is unrecoverable, so require an explicit flag.
     To add content without destroying anything, use seedContent.js instead. */
  if (!process.argv.includes('--force')) {
    console.error('');
    console.error('  seed.js wipes ALL users, events and members before inserting.');
    console.error('  Any admin account, real event or member record will be lost.');
    console.error('');
    console.error('  To add demo content without deleting anything, run:');
    console.error('      npm run seed:content');
    console.error('');
    console.error('  If you really do want to reset the database, run:');
    console.error('      node seed.js --force');
    console.error('');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    await Promise.all([
      User.deleteMany(),
      Event.deleteMany(),
      Member.deleteMany(),
    ]);
    console.log('Existing data cleared');

    await User.create(users);
    await Event.insertMany(events);
    await Member.insertMany(members);

    console.log('✔ Seed data inserted successfully');
    console.log('  Admin email    : admin@ieeoembs.com');
    console.log('  Admin password : Admin@1234');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
