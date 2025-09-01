import express from "express";
import multer from "multer";
import {
  processFileMatch,
  clearDB,
  getAllMatches,
} from "../controller/verifyRecordsController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/match",
  upload.fields([{ name: "pdfFile" }, { name: "excelFile" }]),
  processFileMatch
);
router.post("/clear-records", clearDB);
router.get("/matches", getAllMatches);

export default router;
