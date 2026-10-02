const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getPublicDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ published: true, public: true }).sort({ order: 1, createdAt: -1 });
  sendResponse(res, 200, documents);
});

exports.getAll = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { published: true, public: true };
  const documents = await Document.find(filter).sort({ order: 1, createdAt: -1 });
  sendResponse(res, 200, documents);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid document ID');
  const document = await Document.findById(req.params.id);
  if (!document) return sendError(res, 404, 'Document not found');
  sendResponse(res, 200, document);
});

exports.create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');
  if (!req.file && !req.body.fileUrl)
    return sendError(res, 400, 'A document file is required');

  if (req.file) req.body.fileUrl = req.file.path;
  if (req.file && req.file.mimetype)      req.body.mimeType         = req.file.mimetype;
  if (req.file && req.file.originalname)  req.body.originalFilename = req.file.originalname;

  const document = await Document.create(req.body);
  sendResponse(res, 201, document, 'Document created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid document ID');
  if (req.file) {
    req.body.fileUrl          = req.file.path;
    req.body.mimeType         = req.file.mimetype || req.body.mimeType || '';
    req.body.originalFilename = req.file.originalname || req.body.originalFilename || '';
  }

  const document = await Document.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!document) return sendError(res, 404, 'Document not found');
  sendResponse(res, 200, document, 'Document updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid document ID');
  const document = await Document.findByIdAndDelete(req.params.id);
  if (!document) return sendError(res, 404, 'Document not found');
  sendResponse(res, 200, null, 'Document deleted');
});
