import fs from "fs";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import BulkRecord from "../models/BulkRecord.js";
import { COURT_MAP } from "../stationMap/COURT_MAP.js";


// Normalize & lookup court station
function normalizeCourt(rawStation) {
  const key = rawStation.toUpperCase().replace(/\s+/g, " ").trim();
  return COURT_MAP[key] || "Unknown Court";
}

// ================================
// Upload PDFs and parse into records
// ================================
// Upload PDFs and parse into records
export const bulkUploadRecords = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No PDF files uploaded" });
    }

    const uploadedRecords = [];

    for (const file of req.files) {
      console.log(`Processing file: ${file.originalname}`);

      // Read PDF
      let pdfBuffer;
      try {
        pdfBuffer = fs.readFileSync(file.path);
      } catch (err) {
        console.error("Failed to read PDF file:", file.originalname, err.message);
        continue;
      }

      // Extract text from PDF
      let text = "";
      try {
        const parsed = await pdfParse(pdfBuffer);
        text = parsed.text || "";

        // Fallback to OCR if PDF has no text
        if (!text.trim()) {
          console.log("No text found, using OCR...");
          const { data: { text: ocrText } } = await Tesseract.recognize(pdfBuffer, "eng");
          text = ocrText;
        }
      } catch (err) {
        console.error("Failed to parse PDF:", err.message);
        continue;
      }

      // Normalize whitespace
      text = text.replace(/\r\n|\n/g, " ").replace(/\s{2,}/g, " ");

      // ✅ Extract Volume No (fix: capture full "CXXVII—No. 155")
      let volumeNo = "Unknown";
      const volumeMatchText = text.match(/Vol\.\s*([A-Z0-9—\-\.\s]+No\.\s*\d+)/i);
      if (volumeMatchText) {
        volumeNo = volumeMatchText[1].trim();
      }

      // Get next record number
      let lastRecord = await BulkRecord.findOne().sort({ no: -1 });
      let nextNo = lastRecord ? lastRecord.no + 1 : 1;

      // ✅ Capture court station headings (up to city only)
      const courtHeadingRegex =
        /(IN THE HIGH COURT OF KENYA AT\s+[A-Z]+|CHIEF MAGISTRATE\S* COURT AT\s+[A-Z]+|MAGISTRATE\S* COURT (AT|OF)\s+[A-Z]+)/gi;

      let courtHeadings = [];
      let match;
      while ((match = courtHeadingRegex.exec(text)) !== null) {
        courtHeadings.push({
          station: match[0],
          index: match.index,
        });
      }

      // Split into cause blocks
      const blocks = text.split(/CAUSE NO\./gi);

      for (const block of blocks) {
        const cleanBlock = block.trim();
        if (!cleanBlock) continue;

        // Extract Cause No
        const causeMatch = cleanBlock.match(/E\s*\d{1,4}\s*OF\s*\d{4}/i);
        if (!causeMatch) continue;
        const causeNo = causeMatch[0].trim();

        // ✅ Extract Name of Deceased (fix: avoid Gazette boilerplate)
        const nameMatch = cleanBlock.match(/By\s+(?:\(\d+\)\s+)?(.*?),\s.*?the deceased/i);
        if (!nameMatch) continue;
        const nameOfDeceased = nameMatch[1].trim();

        // ✅ Find nearest court station above this block & standardize
        let blockIndex = text.indexOf(cleanBlock);
        let courtStation = "Unknown Court";

        for (let i = courtHeadings.length - 1; i >= 0; i--) {
          if (courtHeadings[i].index < blockIndex) {
            let rawStation = courtHeadings[i].station.trim();

            let city = rawStation
              .replace(/IN THE HIGH COURT OF KENYA AT/i, "")
              .replace(/CHIEF MAGISTRATE\S* COURT AT/i, "")
              .replace(/MAGISTRATE\S* COURT (AT|OF)/i, "")
              .trim();

            // Normalize casing
            city = city
              .split(/\s+/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");

            // Decide type
            if (/HIGH COURT/i.test(rawStation)) {
              courtStation = `${city} High Court`;
            } else if (/CHIEF MAGISTRATE/i.test(rawStation)) {
              courtStation = `${city} Chief Magistrate Court`;
            } else if (/MAGISTRATE/i.test(rawStation)) {
              courtStation = `${city} Magistrate Court`;
            } else {
              courtStation = city; // fallback
            }
            break;
          }
        }

        // Extract Date Published (optional)
        let datePublished = null;
        let dateMatch = cleanBlock.match(/(\d{1,2}(st|nd|rd|th)?\s+\w+\s+\d{4})/i);
        if (dateMatch) datePublished = new Date(dateMatch[0]);

        if (!datePublished || isNaN(datePublished.getTime())) {
          dateMatch = cleanBlock.match(/(\d{1,2}[–-]\d{1,2}[–-]\d{4})/);
          if (dateMatch) {
            const parts = dateMatch[0].split(/[–-]/).map((p) => parseInt(p, 10));
            if (parts.length === 3) datePublished = new Date(parts[2], parts[1] - 1, parts[0]);
          }
        }

        if (datePublished && isNaN(datePublished.getTime())) datePublished = null;

        try {
          const record = new BulkRecord({
            no: nextNo,
            courtStation,
            causeNo,
            nameOfDeceased,
            dateReceived: new Date(),
            statusAtGP: "Published",
            volumeNo,
            datePublished,
            sourceFile: file.originalname,
          });

          await record.save();
          uploadedRecords.push(record);
          nextNo++;
        } catch (dbErr) {
          console.error("Failed to save bulk record:", { causeNo, nameOfDeceased }, dbErr.message);
        }
      }

      // Remove temporary PDF
      fs.unlink(file.path, (err) => {
        if (err) console.error("Failed to remove temp file:", file.path, err.message);
      });
    }

    res.status(201).json({
      success: true,
      message: `${uploadedRecords.length} bulk records extracted & saved`,
      count: uploadedRecords.length,
      records: uploadedRecords,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process PDF(s)",
      error: error.message,
    });
  }
};

// ================================
// Fetch all bulk records
// ================================
export const fetchAllBulkRecords = async (req, res) => {
  try {
    const records = await BulkRecord.find().sort({ no: 1 });
    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Failed to fetch bulk records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bulk records",
      error: error.message,
    });
  }
};


export const getBulkStats = async (req, res) => {
  try {
    // Total number of uploaded cases
    const totalCases = await BulkRecord.countDocuments();

    // Total number of unique courts
    const courts = await BulkRecord.distinct("courtStation");
    const totalCourts = courts.length;

    // Group by Volume No
    const byVolumeAgg = await BulkRecord.aggregate([
      { $group: { _id: "$volumeNo", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const byVolume = {};
    byVolumeAgg.forEach((v) => {
      byVolume[v._id] = v.count;
    });

    // Recent 5 gazettes (by published date)
    const recentBulk = await BulkRecord.find({})
      .sort({ datePublished: -1 })
      .limit(5)
      .select("volumeNo datePublished")
      .lean();

    res.json({
      totalCases,
      totalCourts,
      byVolume,
      recentBulk
    });
  } catch (err) {
    console.error("Bulk stats error:", err);
    res.status(500).json({ message: "Failed to fetch bulk stats" });
  }
};

export const getBulkReport = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    // Default last 30 days if not provided
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now;
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    }

    const report = await BulkRecord.aggregate([
      {
        $match: {
          datePublished: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            court: "$courtStation",
            volume: "$volumeNo",
          },
          totalCases: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.court",
          volumes: {
            $push: {
              volume: "$_id.volume",
              totalCases: "$totalCases",
            },
          },
          totalCases: { $sum: "$totalCases" },
        },
      },
      { $sort: { totalCases: -1 } },
    ]);

    res.json({
      startDate,
      endDate,
      report,
    });
  } catch (err) {
    console.error("Bulk report error:", err);
    res.status(500).json({ message: "Failed to fetch bulk report" });
  }
};


