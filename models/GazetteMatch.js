import mongoose from "mongoose";

const gazetteMatchSchema = new mongoose.Schema(
  {
    name_of_deceased: { type: String, required: true },

    // From PDF
    cause_no: { type: String, index: true },
    volume_no: String,
    date_published: String,

    // From Excel
    court_station: { type: String, index: true },
    excel_name: String,
    other_excel_fields: { type: mongoose.Schema.Types.Mixed },

    // Match info
    match_score: Number,
    review_score: Number,
    status_at_gp: { type: String, default: "Pending" },
    approval_date: String,
    match_type: { type: String, enum: ["accepted", "review"], default: "review" },

    // History of changes
    history: [
      {
        updatedAt: { type: Date, default: Date.now },
        data: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Ensure uniqueness
gazetteMatchSchema.index(
  { name_of_deceased: 1, cause_no: 1, court_station: 1 },
  { unique: true }
);

// ✅ Prevent OverwriteModelError
export const GazetteMatch =
  mongoose.models.GazetteMatch ||
  mongoose.model("GazetteMatch", gazetteMatchSchema);
