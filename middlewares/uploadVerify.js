import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const fileFilter = (_, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ].includes(file.mimetype);
  cb(allowed ? null : new Error("Only PDF and Excel files are allowed"), allowed);
};

export const uploadVerify = multer({ storage, fileFilter });
