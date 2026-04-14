const multer = require("multer");
const path = require("path");

// Temporary storage
const storage = multer.diskStorage({});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/; // Allow images and PDFs
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png) and PDFs are allowed!"));
    }
  },
});

module.exports = upload;