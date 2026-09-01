const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Project      = require('../models/Project');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await paginate(Project, {}, { createdAt: -1 }, req.query, { path: 'members', select: 'name role' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');
  const project = await Project.findById(req.params.id).populate('members', 'name role photo');
  if (!project) return sendError(res, 404, 'Project not found');
  sendResponse(res, 200, project);
});

exports.create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');
  if (req.file) req.body.thumbnail = req.file.path;
  const project = await Project.create(req.body);
  sendResponse(res, 201, project, 'Project created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');
  if (req.file) req.body.thumbnail = req.file.path;
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!project) return sendError(res, 404, 'Project not found');
  sendResponse(res, 200, project, 'Project updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid project ID');
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) return sendError(res, 404, 'Project not found');
  sendResponse(res, 200, null, 'Project deleted');
});
