import mongoose from "mongoose";
import Court from "./models/Court.js";
import courts from "./courtsData.js"; // the file we just created

const seedCourts = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/yourdb");
    await Court.deleteMany(); // optional: clear old data
    await Court.insertMany(courts);
    console.log("Courts added successfully");
    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

seedCourts();
