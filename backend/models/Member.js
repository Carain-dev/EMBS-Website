const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    batch: { type: String, default: '' },
    photo: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    email: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    /* inOrgChart controls whether this member appears in the About page
       Organizational Structure chart.  It is independent of `active`:
       a past chair can remain active in the member directory while being
       removed from the org chart, and vice-versa. */
    inOrgChart: { type: Boolean, default: false },
    /* isFacultyCoordinator: true → this member appears in the
       Home page Faculty Coordinators section.
       Completely independent of inOrgChart and active. */
    isFacultyCoordinator: { type: Boolean, default: false },
    /* isFacultyAdvisor: true → this member appears in the
       Faculty Advisors section on the public Members page.
       Stores Faculty Advisor, Co-Advisor, and any additional
       faculty members.  Independent of all other flags. */
    isFacultyAdvisor: { type: Boolean, default: false },
    /* bio: optional short bio shown on faculty advisor cards */
    bio: { type: String, default: '' },
  },
  { timestamps: true }
);

/* The directory lists active members in display order.
   A second index speeds up the org-chart query on the public About page. */
memberSchema.index({ active: 1, order: 1 });
memberSchema.index({ inOrgChart: 1, order: 1 });
memberSchema.index({ isFacultyCoordinator: 1, active: 1, order: 1 });
memberSchema.index({ isFacultyAdvisor: 1, active: 1, order: 1 });

module.exports = mongoose.model('Member', memberSchema);
