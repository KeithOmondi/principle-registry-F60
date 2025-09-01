import mongoose from "mongoose";
import Court from "./models/Court.js";
import courts from "./courtsData.js"; // import the completed array we just created

const seedCourts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/yourdb", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected...");

    // Optional: clear old data
    await Court.deleteMany();
    console.log("Old courts cleared.");

    // Insert new courts
    const insertedCourts = await Court.insertMany(courts);

    insertedCourts.forEach((court) => {
      console.log(`Inserted: ${court.name}`);
    });

    console.log("All courts added successfully.");
  } catch (err) {
    console.error("Error seeding courts:", err);
  } finally {
    mongoose.disconnect();
  }
};

seedCourts();
