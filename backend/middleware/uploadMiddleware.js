const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DOC_MIMES   = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const createStorage = (folder, resourceType) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `embs/${folder}`,
      resource_type: resourceType || 'image',
      allowed_formats: resourceType === 'raw'
        ? ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']
        : ['jpg', 'jpeg', 'png', 'webp'],
      transformation: resourceType === 'raw'
        ? undefined
        : [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });

const imageFilter = (req, file, cb) => {
  IMAGE_MIMES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Only jpg, jpeg, png, webp images are allowed'));
};

const attachmentFilter = (req, file, cb) => {
  IMAGE_MIMES.includes(file.mimetype) || DOC_MIMES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Only images and PDF/DOC documents are allowed'));
};

// createUpload(folder)          — images only (existing behaviour)
// createUpload(folder, 'raw')   — images + documents (announcements)
const createUpload = (folder, resourceType) =>
  multer({
    storage: createStorage(folder, resourceType),
    fileFilter: resourceType === 'raw' ? attachmentFilter : imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

module.exports = createUpload;
