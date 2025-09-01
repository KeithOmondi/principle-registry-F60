import mongoose from "mongoose";

const bulkRecordSchema = new mongoose.Schema(
  {
    no: { type: Number, required: true },
    courtStation: { type: String, default: "Unknown" },
    causeNo: { type: String, required: true },
    nameOfDeceased: { type: String, required: true },
    dateReceived: { type: Date, default: Date.now },
    statusAtGP: { type: String, default: "Published" },
    volumeNo: { type: String, default: "Unknown" },
    datePublished: { type: Date },
    sourceFile: { type: String }, // optional: name of PDF uploaded
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional
  },
  { timestamps: true }
);

export default mongoose.model("BulkRecord", bulkRecordSchema);
