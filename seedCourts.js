import mongoose from "mongoose";
import Court from "./models/Court.js";

const courts = [
  { name: "Supreme Court", type: "Superior" },
  { name: "Court of Appeal", type: "Superior" },
  { name: "High Court", type: "Superior" },
  { name: "Employment and Labour Relations Court", type: "Specialized" },
  { name: "Environment and Land Court", type: "Specialized" },
  { name: "Magistrates’ Courts", type: "Subordinate" },
  { name: "Kadhi’s Courts", type: "Subordinate" },
  { name: "Military Courts", type: "Specialized" }
];

const seed = async () => {
  try {
    await mongoose.connect("mongodb+srv://kdomondi1:keith.@cluster0.8brzayi.mongodb.net/GAZETTE_SYSTEM?retryWrites=true&w=majority&appName=Cluster0");
    await Court.deleteMany(); // optional, clears old data
    await Court.insertMany(courts);
    console.log("Courts seeded ✅");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
