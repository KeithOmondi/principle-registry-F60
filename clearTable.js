import mongoose from "mongoose";
import BulkRecord from "./models/BulkRecord.js"; // adjust the path if needed

// MongoDB connection URI
const uri = "mongodb+srv://kdomondi1:keith.@cluster0.8brzayi.mongodb.net/GAZETTE_SYSTEM?retryWrites=true&w=majority&appName=Cluster0";

async function clearBulkRecords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    // Delete all documents in the bulkrecords collection
    const result = await BulkRecord.deleteMany({});
    console.log(`Deleted ${result.deletedCount} documents from bulkrecords collection.`);

    // Disconnect
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB. Collection is now empty.");
  } catch (err) {
    console.error("Error clearing bulkrecords:", err);
    process.exit(1);
  }
}

// Run the script
clearBulkRecords();
