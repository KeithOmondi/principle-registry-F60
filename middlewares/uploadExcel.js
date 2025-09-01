// middlewares/uploadExcel.js
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// ✅ Only allow Excel files
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // .xlsx
    file.mimetype === "application/vnd.ms-excel" // .xls
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed"), false);
  }
};

export const uploadExcel = multer({ storage, fileFilter });
