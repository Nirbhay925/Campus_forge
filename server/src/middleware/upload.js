const multer = require('multer');

/**
 * CONCEPT EXPLANATION: File Upload Handling with Multer
 * ----------------------------------------------------
 * Express cannot read binary files (like PDFs) by default.
 * Multer intercepts the upload stream, inspects the file, and puts the
 * raw binary bytes into `req.file.buffer` in server memory.
 * 
 * Safety Rules:
 * 1. Only allow .pdf files (rejects .exe, .png, etc.)
 * 2. Limit file size to 5MB (prevents server crashes)
 * 3. Use memoryStorage for instant text parsing without saving temp files.
 */

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Check if the uploaded file has a PDF MIME type or .pdf extension
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type: Only PDF resumes are allowed!'), false);
    }
};

const uploadResumeMiddleware = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB maximum file size limit
    },
    fileFilter: fileFilter
});

module.exports = {
    uploadResumeMiddleware
};
