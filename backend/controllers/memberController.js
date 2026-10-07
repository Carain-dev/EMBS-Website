const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Member       = require('../models/Member');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');
const { resolveAdminView, denyMessage } = require('../utils/requestAuth');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ── Get All Members ─────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  /* ?all=true — admin view: every member regardless of status
     ?orgchart=true — public org-chart fetch: only inOrgChart members,
                      regardless of active flag, sorted by display order
     default — public directory: active members only */
  let filter;
  if (req.query.all === 'true') {
    /* Admin view (includes inactive members): requires a valid staff token. */
    const view = await resolveAdminView(req, { flags: ['all'], header: false });
    if (view.deny) return sendError(res, view.deny, denyMessage(view.deny));
    filter = {};
  } else if (req.query.orgchart === 'true') {
    filter = { inOrgChart: true };
  } else if (req.query.faculty === 'true') {
    /* Public home-page Faculty Coordinators section:
       only members flagged as faculty coordinators AND active */
    filter = { isFacultyCoordinator: true, active: true };
  } else if (req.query.advisor === 'true') {
    /* Public Members page Faculty Advisors section:
       only members flagged as faculty advisors AND active, ordered by display order */
    filter = { isFacultyAdvisor: true, active: true };
  } else {
    filter = { active: true };
  }

  const { rows, meta } = await paginate(Member, filter, { order: 1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

/* ── Get Single Member ───────────────────────── */
exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  const member = await Member.findById(req.params.id);
  if (!member) return sendError(res, 404, 'Member not found');

  /* Publicly a member is visible when active or shown in the org chart (the
     same members the public pages list); anything else is admin-only. */
  if (!member.active && !member.inOrgChart && !(await resolveAdminView(req, { flags: ['all'] })).admin)
    return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, member);
});

/* ── Create Member ───────────────────────────── */
exports.create = asyncHandler(async (req, res) => {
  const { name, role } = req.body;
  if (!name || !role)
    return sendError(res, 400, 'Name and role are required');

  if (req.file) req.body.photo = req.file.path;

  const member = await Member.create(req.body);
  sendResponse(res, 201, member, 'Member created');
});

/* ── Update Member ───────────────────────────── */
exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  if (req.file) req.body.photo = req.file.path;

  const member = await Member.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!member) return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, member, 'Member updated');
});

/* ── Delete Member ───────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, null, 'Member deleted');
});
