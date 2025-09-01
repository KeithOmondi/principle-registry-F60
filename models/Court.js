import mongoose from "mongoose";

const courtSchema = new mongoose.Schema({
  name: { type: String, required: true },
  magistrate: { type: String },
  position: { type: String }, // e.g., Chief Magistrate, Senior Principal
  phone: { type: String },
  email: { type: String },
  courtEmail: { type: String },
});

const Court = mongoose.model("Court", courtSchema);
export default Court;
