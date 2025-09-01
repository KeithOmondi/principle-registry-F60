// controller/verifyRecordsController.js
import fs from "fs";
import xlsx from "xlsx";
import pdfParse from "pdf-parse";
import {
  bestExcelNameKey,
  normalizeNameDB,
  tokensAsSet,
  jaccard as jaccardFromUtils,
} from "../utils/normalize.js";

/** ---------- Helpers ---------- **/

function safeJaccard(a, b) {
  const toArr = (x) => {
    if (!x) return [];
    if (x instanceof Set) return Array.from(x);
    if (Array.isArray(x)) return x;
    return String(x).split(/\s+/).filter(Boolean);
  };
  return jaccardFromUtils(toArr(a), toArr(b));
}

const squashSpaces = (s = "") => String(s).replace(/\s+/g, " ").trim();

/** ---------- Gazette PDF Parsing ---------- **/
function parseGazettePDF(pdfText) {
  const lines = pdfText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const records = [];

  let currentVolume = "";
  let currentDate = "";
  let buffer = [];

  const commit = () => {
    if (!buffer.length) return;
    const text = squashSpaces(buffer.join(" "));

    const volMatch = text.match(/Vol\.\s*[A-Z0-9\-]+\s*[—–-]?\s*No\.\s*\d+/i);
    if (volMatch) currentVolume = volMatch[0].trim();

    const dateMatch = text.match(
      /\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,\s*\d{4}\b/
    );
    if (dateMatch) currentDate = dateMatch[0].trim();

    const causeMatch = text.match(
      /CAUSE NO\.\s*([A-Z]?\d+(?:\s*OF\s*\d{4}|\/\d{4})?)/i
    );
    const causeNo = causeMatch
      ? squashSpaces(causeMatch[1]).replace(/\s*OF\s*/i, " OF ")
      : "";

    let names = [...text.matchAll(/\bestate of\s+([^,.;:]+)/gi)].map((m) =>
      squashSpaces(m[1])
    );
    if (!names.length) {
      const fallback = [...text.matchAll(/grant[^.]*?estate of\s+([^,.;:]+)/gi)];
      fallback.forEach((m) => m[1] && names.push(squashSpaces(m[1])));
    }
    names = Array.from(new Set(names.filter(Boolean)));

    names.forEach((nm) => {
      records.push({
        cause_no: causeNo,
        name_of_deceased: nm,
        volume_no: currentVolume || "",
        date_published: currentDate || "",
        _name_norm: normalizeNameDB(nm),
        _matched: false,
      });
    });

    buffer = [];
  };

  for (const line of lines) {
    if (/^Vol\.\s*/i.test(line) || /^CAUSE NO\./i.test(line)) {
      commit();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  commit();

  return records;
}

/** ---------- File persistence ---------- **/
const DATA_FILE = "./matches.json";

let inMemoryMatches = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    inMemoryMatches = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.log(`✅ Loaded ${inMemoryMatches.length} matches from ${DATA_FILE}`);
  } catch (err) {
    console.error("⚠️ Failed to load matches.json:", err);
    inMemoryMatches = [];
  }
}

function saveMatches() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryMatches, null, 2));
  } catch (err) {
    console.error("⚠️ Failed to save matches.json:", err);
  }
}

/** ---------- Main Controller ---------- **/
export async function processFileMatch(req, res, next) {
  try {
    const { threshold = 0.85 } = req.query;
    const acceptThreshold = Number(threshold);
    const reviewThreshold = 0.5;

    const pdfFile = req.files?.pdfFile?.[0];
    const excelFile = req.files?.excelFile?.[0];
    if (!pdfFile || !excelFile) {
      return res.status(400).json({ error: "Missing PDF or Excel file" });
    }

    /** ---- Parse Excel ---- **/
    const excelBuffer = fs.readFileSync(excelFile.path);
    const workbook = xlsx.read(excelBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      return res.status(400).json({ error: "Excel has no sheets" });
    }
    const sheet = workbook.Sheets[sheetName];
    const excelRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    excelRows.forEach((ex) => {
      const raw =
        ex["Name of The Deceased"] ||
        ex["Name of Deceased"] ||
        bestExcelNameKey(ex) ||
        "";
      ex._name_raw = String(raw).trim();
      ex._name_norm = normalizeNameDB(ex._name_raw);
    });

    const filteredExcelRows = excelRows.filter((r) => r._name_raw);

    /** ---- Parse Gazette PDF ---- **/
    const pdfBuffer = fs.readFileSync(pdfFile.path);
    const pdfData = await pdfParse(pdfBuffer);
    const gazetteRecords = parseGazettePDF(pdfData.text || "");

    const gazetteMap = new Map();
    gazetteRecords.forEach((g) => {
      const key = g._name_norm;
      if (!gazetteMap.has(key)) gazetteMap.set(key, []);
      gazetteMap.get(key).push(g);
    });

    /** ---- Matching ---- **/
    const accepted = [];
    const review = [];

    for (const ex of filteredExcelRows) {
      let bestMatch = null;
      let bestScore = 0;

      for (const [normName, records] of gazetteMap.entries()) {
        const score = safeJaccard(
          tokensAsSet(ex._name_norm),
          tokensAsSet(normName)
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = records[0];
        }
      }

      if (bestMatch && bestScore >= reviewThreshold) {
        bestMatch._matched = true;

        const merged = { ...ex };
        merged.name_of_deceased = merged._name_raw;

        // From PDF
        merged.cause_no = bestMatch.cause_no || "";
        merged.volume_no = bestMatch.volume_no || "";
        merged.date_published = bestMatch.date_published || "";

        // From Excel
        merged.court_station = ex["Court Station"] || ex.court_station || "";

        if (bestScore >= acceptThreshold) {
          merged.status_at_gp = merged.status_at_gp || "Published";
          merged.approval_date =
            merged.approval_date || new Date().toLocaleDateString("en-GB");
          merged.match_score = Number(bestScore.toFixed(3));
          accepted.push(merged);
        } else {
          merged.review_score = Number(bestScore.toFixed(3));
          review.push(merged);
        }
      }
    }

    const onlyGazette = gazetteRecords.filter((g) => !g._matched);

    const allMatches = [...accepted, ...review].map((row, idx) => ({
      id: idx + 1,
      ...row,
    }));
    inMemoryMatches = allMatches;

    // 🔥 Save to file
    saveMatches();

    return res.json({
      success: true,
      mode: "tokens",
      acceptThreshold,
      reviewThreshold,
      totalExcel: excelRows.length,
      totalExcelUsed: filteredExcelRows.length,
      totalGazette: gazetteRecords.length,
      matchedCount: accepted.length + review.length,
      insertedCount: allMatches.length,
      accepted,
      review,
      onlyGazette,
      matchedRows: allMatches,
    });
  } catch (err) {
    console.error("Error in processFileMatch:", err);
    return next(err);
  }
}

/** ---------- Clear ---------- **/
export async function clearDB(req, res) {
  inMemoryMatches = [];
  saveMatches();
  return res.json({ success: true, deleted: true });
}

/** ---------- Get matches ---------- **/
export async function getAllMatches(req, res) {
  return res.json({
    success: true,
    count: inMemoryMatches.length,
    rows: inMemoryMatches,
  });
}
