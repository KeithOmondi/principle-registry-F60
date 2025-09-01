// routes/match.js
import express from "express";
import multer from "multer";
import { saveMatchesToDB, clearMatches, GazetteMatch } from "../helpers/db.js";
import { bestExcelNameKey, normalizeNameDB, tokensAsSet, jaccard } from "../utils/normalize.js";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

/**
 * Process matches between gazetteRecords and excelRows
 */
async function processMatches({
  mode,
  candidates = [],
  gazetteRecords = [],
  excelRows = [],
  acceptThreshold = 0.8,
  reviewThreshold = 0.5,
}) {
  const accepted = [];
  const review = [];

  for (const { g, ex, score } of candidates) {
    if (!g || !ex) continue;

    const publicRow = {
      court_station: g.court_station,
      cause_no: g.cause_no,
      name_of_deceased: g.name_of_deceased,
      status_at_gp: score >= acceptThreshold ? "Approved" : "Published",
      volume_no: g.volume_no || "",
      date_published: g.date_published || "",
      excel_name: ex._name_raw,
    };

    const enriched = { public: publicRow, _score: score, _g: g, _e: ex };

    if (score >= acceptThreshold) accepted.push(enriched);
    else if (score >= reviewThreshold) review.push(enriched);
  }

  // Save accepted matches to MongoDB
  const rowsToSave = accepted.map(m => m.public);
  const inserted = await saveMatchesToDB(rowsToSave);

  return {
    success: true,
    mode,
    acceptThreshold,
    reviewThreshold,
    matchedCount: accepted.length + review.length,
    insertedCount: inserted.length,
    accepted,
    review,
  };
}

// POST /process — direct processing
router.post("/process", async (req, res, next) => {
  try {
    const result = await processMatches(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /clear-records — wipe DB
router.post("/clear-records", async (_req, res, next) => {
  try {
    const n = await clearMatches();
    res.json({ success: true, deleted: n });
  } catch (err) {
    next(err);
  }
});

// GET /matches — fetch saved matches
router.get("/matches", async (_req, res, next) => {
  try {
    const rows = await GazetteMatch.find().sort({ date_published: -1, _id: -1 });
    res.json({ success: true, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

// POST /match — upload PDF + Excel, parse, then process
router.post(
  "/match",
  upload.fields([{ name: "pdfFile" }, { name: "excelFile" }]),
  async (req, res, next) => {
    try {
      const { mode = "tokens", threshold = 0.8 } = req.query;
      const pdfFile = req.files.pdfFile?.[0];
      const excelFile = req.files.excelFile?.[0];

      if (!pdfFile || !excelFile)
        return res.status(400).json({ error: "Missing files" });

      // TODO: implement actual parsing
      const gazetteRecords = []; // parseGazette(pdfFile.path)
      const excelRows = [];      // parseRegistry(excelFile.path)

      // Normalize Excel names
      excelRows.forEach(ex => {
        ex._name_raw = bestExcelNameKey(ex);
        ex._name_norm = normalizeNameDB(ex._name_raw);
      });

      // Normalize Gazette names
      gazetteRecords.forEach(g => {
        g._name_norm = normalizeNameDB(g.name_of_deceased);
      });

      // Build candidates
      const candidates = [];
      for (const g of gazetteRecords) {
        for (const ex of excelRows) {
          const score = jaccard(
            Array.from(tokensAsSet(g._name_norm)),
            Array.from(tokensAsSet(ex._name_norm))
          );
          if (score > 0) candidates.push({ g, ex, score });
        }
      }

      const result = await processMatches({
        mode,
        candidates,
        gazetteRecords,
        excelRows,
        acceptThreshold: Number(threshold),
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
