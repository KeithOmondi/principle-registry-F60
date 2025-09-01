// utils/multer.js
import multer from "multer";

// Store files in memory (buffer) instead of saving to disk
const storage = multer.memoryStorage();

// Optional file type filter (still recommended)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and JPG images are allowed"), false);
  }
};

export const upload = multer({ storage, fileFilter });
