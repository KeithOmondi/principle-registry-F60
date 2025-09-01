import express from "express";
import multer from "multer";
import {
  isAuthenticated,
  isAuthorized,
} from "../middlewares/authMiddleware.js";
import {
  bulkUploadRecords,
  fetchAllBulkRecords,
  getBulkReport,
  getBulkStats,
} from "../controller/bulkUploadController.js";

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// POST /api/v1/bulk-upload
router.post("/bulk-upload", upload.array("files"), bulkUploadRecords);
router.get(
  "/records",
  isAuthenticated,
  isAuthorized("Admin"),
  fetchAllBulkRecords
);

router.get("/stats", isAuthenticated, isAuthorized("Admin"), getBulkStats);
router.get("/report", isAuthenticated, isAuthorized("Admin"), getBulkReport);


export default router;
