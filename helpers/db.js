import mongoose from "mongoose";

// -------------------- Connect to MongoDB --------------------
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// -------------------- GazetteMatch Schema --------------------
const gazetteMatchSchema = new mongoose.Schema(
  {
    court_station: { type: String, required: true },
    cause_no: { type: String, required: true },
    name_norm: { type: String, required: true },
    name_of_deceased: { type: String, required: true },
    excel_name: { type: String },
    match_type: { type: String },
    duplicate: { type: Boolean, default: false },
    status_at_gp: { type: String, default: "Published" },
    volume_no: { type: String },
    date_published: { type: String },
  },
  { timestamps: true }
);

// -------------------- Indexes --------------------
gazetteMatchSchema.index({ excel_name: 1 });
gazetteMatchSchema.index({ court_station: 1, date_published: 1 });

export const GazetteMatch = mongoose.model("GazetteMatch", gazetteMatchSchema);

// -------------------- Normalize Strings --------------------
export const normalizeForDB = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// -------------------- Save Matches to DB --------------------
export async function saveMatchesToDB(matches = [], batchSize = 500) {
  if (!Array.isArray(matches) || matches.length === 0) return { inserted: 0 };

  let insertedCount = 0;

  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);

    try {
      const res = await GazetteMatch.insertMany(batch, { ordered: false });
      insertedCount += res.length;
    } catch (err) {
      console.error("⚠ Insert error (duplicates skipped):", err.message);
    }
  }

  // -------------------- Flag Duplicates --------------------
  const dupes = await GazetteMatch.aggregate([
    { $match: { excel_name: { $ne: null } } },
    { $group: { _id: "$excel_name", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (dupes.length > 0) {
    const duplicateNames = dupes.map((d) => d._id);
    await GazetteMatch.updateMany(
      { excel_name: { $in: duplicateNames } },
      { $set: { duplicate: true } }
    );
  }

  return { inserted: insertedCount };
}

// -------------------- Clear All Matches --------------------
export async function clearMatches() {
  const res = await GazetteMatch.deleteMany({});
  return res.deletedCount;
}
