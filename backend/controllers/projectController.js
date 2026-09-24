const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Project      = require('../models/Project');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const isAdminRequest = (req) => /^Bearer /i.test(String(req.headers.authorization || '')) || req.query.all === 'true';

const parseStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeProjectPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.description === 'string') next.description = next.description.trim();
  if (typeof next.category === 'string') next.category = next.category.trim();
  if (typeof next.mentor === 'string') next.mentor = next.mentor.trim();

  const teamMembers = parseStringList(next.teamMembers ?? next.members ?? next.team);
  if (teamMembers.length) next.teamMembers = teamMembers;

  const tags = parseStringList(next.tags ?? next.technologies);
  if (tags.length) next.tags = tags;

  if (typeof next.repoUrl === 'string' && !next.repoUrl && typeof next.githubLink === 'string') next.repoUrl = next.githubLink.trim();
  if (typeof next.paperUrl === 'string' && !next.paperUrl && typeof next.paperLink === 'string') next.paperUrl = next.paperLink.trim();
  if (typeof next.liveUrl === 'string' && !next.liveUrl && typeof next.demoLink === 'string') next.liveUrl = next.demoLink.trim();

  if (Object.prototype.hasOwnProperty.call(next, 'featured')) {
    next.featured = normalizeBoolean(next.featured);
  }

  if (!next.status) next.status = next.featured ? 'published' : 'ongoing';

  if (Object.prototype.hasOwnProperty.call(next, 'visibility')) {
    next.visibility = next.visibility === 'hidden' ? 'hidden' : 'visible';
  } else {
    next.visibility = next.featured ? 'visible' : 'hidden';
  }

  return next;
};

exports.getAll = asyncHandler(async (req, res) => {
  const filter = isAdminRequest(req)
    ? {}
    : { featured: true, visibility: { $ne: 'hidden' } };

  const { rows, meta } = await paginate(Project, filter, { createdAt: -1 }, req.query, { path: 'members', select: 'name role' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');

  const project = await Project.findById(req.params.id).populate('members', 'name role photo');
  if (!project) return sendError(res, 404, 'Project not found');

  const isAdmin = isAdminRequest(req);
  if (!isAdmin && (!project.featured || project.visibility === 'hidden')) {
    return sendError(res, 404, 'Project not found');
  }

  sendResponse(res, 200, project);
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizeProjectPayload(req.body);
  if (!payload.title) return sendError(res, 400, 'Title is required');

  if (req.file) payload.thumbnail = req.file.path;
  const project = await Project.create(payload);
  sendResponse(res, 201, project, 'Project created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');

  const payload = normalizeProjectPayload(req.body);
  if (req.file) payload.thumbnail = req.file.path;

  const project = await Project.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!project) return sendError(res, 404, 'Project not found');
  sendResponse(res, 200, project, 'Project updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) return sendError(res, 404, 'Project not found');
  sendResponse(res, 200, null, 'Project deleted');
});
