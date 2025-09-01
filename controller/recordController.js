import Record from "../models/Record.js";
import fs from "fs";
import pdf from "pdf-parse";
import XLSX from "xlsx";
import stringSimilarity from "string-similarity";


/**
 * Create new record (Admin only)
 */
/**
 * Create new record (Admin only)
 */
export const createRecord = async (req, res) => {
  try {
    const {
      courtStation,
      causeNo,
      nameOfDeceased,
      dateReceived,
      statusAtGP,
      rejectionReason,
      volumeNo,
      datePublished,
    } = req.body;

    // Enforce rejection reason if status is "Rejected"
    if (statusAtGP === "Rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when status is Rejected",
      });
    }

    // Find last record and auto-increment `no`
    const lastRecord = await Record.findOne().sort({ no: -1 });
    const nextNo = lastRecord ? lastRecord.no + 1 : 1;

    const record = new Record({
      no: nextNo,
      courtStation,
      causeNo,
      nameOfDeceased,
      dateReceived,
      statusAtGP,
      rejectionReason: statusAtGP === "Rejected" ? rejectionReason : "",
      volumeNo,
      datePublished,
    });

    await record.save();

    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create record",
      error: error.message,
    });
  }
};

/**
 * Get all records (Public) with pagination, filtering, and search
 */
export const getRecords = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      court = "",
      status = "",
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { causeNo: { $regex: search, $options: "i" } },
        { nameOfDeceased: { $regex: search, $options: "i" } },
        { courtStation: { $regex: search, $options: "i" } },
      ];
    }

    if (court) query.courtStation = court;
    if (status) query.statusAtGP = status;

    const records = await Record.find(query)
      .sort({ datePublished: -1, no: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Record.countDocuments(query);

    res.json({
      records,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single record by ID
 */
export const getRecordById = async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all records (Admin only)
 */
export const getAllRecordsForAdmin = async (req, res, next) => {
  try {
    // Fetch all records, sorted by creation date descending
    const records = await Record.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch records",
      error: error.message,
    });
  }
};

/**
 * Update record (Admin only)
 */
export const updateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusAtGP, rejectionReason, ...rest } = req.body;

    // Enforce rejection reason if status is "Rejected"
    if (statusAtGP === "Rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when status is Rejected",
      });
    }

    const updatedRecord = await Record.findByIdAndUpdate(
      id,
      {
        ...rest,
        statusAtGP,
        rejectionReason: statusAtGP === "Rejected" ? rejectionReason : "",
      },
      { new: true, runValidators: true }
    );

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update record",
      error: error.message,
    });
  }
};

/**
 * Delete record (Admin only)
 */
export const deleteRecord = async (req, res, next) => {
  try {
    const record = await Record.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Record deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upload records (Admin only)
 */
// Helper: Format court station nicely
const formatCourtStation = (rawText) => {
  if (!rawText) return "Unknown";

  // Match something like "CHIEF MAGISTRATE’S COURT AT THIKA"
  const match = rawText.match(/COURT AT\s+([A-Z\s]+)/i);
  if (!match) return "Unknown";

  let city = match[1].trim();

  // Capitalize first letter of each word
  city = city
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return `${city} Magistrate Court`;
};


// controllers/recordController.js
export const getRecordStats = async (req, res) => {
  try {
    const records = await Record.find();

    const totalRecords = records.length;
    const approved = records.filter(r => r.statusAtGP === "Approved").length;
    const pending = records.filter(r => r.statusAtGP === "Pending").length;

    const recent = records
      .sort((a, b) => new Date(b.datePublished) - new Date(a.datePublished))
      .slice(0, 5);

    res.json({ totalRecords, approved, pending, recent });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch stats", error: err.message });
  }
};

/**
 * Bulk add records (Admin only)
 * Accepts an array of record objects
 */
export const bulkAddRecords = async (req, res) => {
  try {
    // Ensure file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "❌ No Excel file uploaded",
      });
    }

    // ✅ Parse Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0]; // first sheet
    const sheet = workbook.Sheets[sheetName];
    let records = XLSX.utils.sheet_to_json(sheet);

    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Uploaded Excel is empty or invalid",
      });
    }

    // ✅ Get last record to auto-increment `no`
    const lastRecord = await Record.findOne().sort({ no: -1 });
    let nextNo = lastRecord ? lastRecord.no + 1 : 1;

    // ✅ Map Excel rows to DB schema
    const formattedRecords = records.map((rec) => ({
      no: nextNo++,
      courtStation: rec["Court Station"] || "", // <-- Column name in Excel
      causeNo: rec["Cause No"] || "",
      nameOfDeceased: rec["Name of Deceased"] || "",
      dateReceived: rec["Date Received"] || "",
      statusAtGP: rec["Status at GP"] || "Pending",
      rejectionReason:
        rec["Status at GP"] === "Rejected" ? rec["Rejection Reason"] || "" : "",
      volumeNo: rec["Volume No"] || "",
      datePublished: rec["Date Published"] || "",
    }));

    // ✅ Insert into MongoDB
    await Record.insertMany(formattedRecords);

    res.status(201).json({
      success: true,
      count: formattedRecords.length,
      message: `✅ Successfully inserted ${formattedRecords.length} records`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "❌ Failed to bulk add records",
      error: error.message,
    });
  }
};

// Extract PDF text into structured records
const extractPdfData = (pdfText) => {
  const lines = pdfText.split("\n").map((l) => l.trim()).filter(Boolean);

  return lines
    .filter((line) => line.match(/Cause\s*No/i) || line.match(/Estate/i))
    .map((line) => ({
      causeNo: line.match(/Cause\s*No[:\s]*([A-Za-z0-9/]+)/i)?.[1] || "N/A",
      nameOfDeceased:
        line.match(/Estate\s*of\s*([A-Za-z\s]+)/i)?.[1]?.trim() || line,
    }));
};

const fuzzyMatch = (a, b, threshold = 0.85) => {
  if (!a || !b) return false;
  return (
    stringSimilarity.compareTwoStrings(a.toLowerCase(), b.toLowerCase()) >=
    threshold
  );
};

export const verifyRecords = async (req, res) => {
  try {
    const excelPath = req.files.excel[0].path;
    const pdfPath = req.files.pdf[0].path;

    // Parse Excel
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelData = XLSX.utils.sheet_to_json(sheet);

    // Parse PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfText = (await pdf(pdfBuffer)).text;
    const pdfRecords = extractPdfData(pdfText);

    // Compare Excel vs PDF
    const matched = [];
    const onlyExcel = [];
    const onlyPdf = [];

    excelData.forEach((excelRow) => {
      const found = pdfRecords.find((pdfRow) =>
        fuzzyMatch(excelRow["Name of Deceased"], pdfRow.nameOfDeceased)
      );
      if (found) {
        matched.push({ ...excelRow, published: true });
      } else {
        onlyExcel.push({ ...excelRow, published: false });
      }
    });

    pdfRecords.forEach((pdfRow) => {
      const found = excelData.find((excelRow) =>
        fuzzyMatch(pdfRow.nameOfDeceased, excelRow["Name of Deceased"])
      );
      if (!found) onlyPdf.push(pdfRow);
    });

    // Cleanup uploaded files
    fs.unlinkSync(excelPath);
    fs.unlinkSync(pdfPath);

    res.json({ matched, onlyExcel, onlyPdf });
  } catch (err) {
    console.error("Verify error:", err);
    res
      .status(500)
      .json({ message: "Verification failed", error: err.message });
  }
};







