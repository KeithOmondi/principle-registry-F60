import express from "express";
import Court from "../models/Court.js";

const router = express.Router();

// Get all courts
router.get("/", async (req, res) => {
  try {
    const courts = await Court.find().sort({ name: 1 });
    res.json(courts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch courts" });
  }
});

// Add new court
router.post("/", async (req, res) => {
  try {
    const { name, type, location } = req.body;
    const court = new Court({ name, type, location });
    await court.save();
    res.status(201).json(court);
  } catch (err) {
    res.status(400).json({ message: "Failed to add court" });
  }
});

export default router;
