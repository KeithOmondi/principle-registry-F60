import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/userModel.js";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";

// ✅ Get All Verified Users
export const getAllUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find({ accountVerified: true });

  res.status(200).json({
    success: true,
    users,
  });
});

// ✅ Register New Admin
export const registerNewAdmin = catchAsyncErrors(async (req, res, next) => {
  // 1. Validate file presence
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Please upload an image", 400));
  }

  const { name, email, password } = req.body;

  // 2. Validate input fields
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please provide all fields", 400));
  }

  // 3. Check for existing admin
  const isRegistered = await User.findOne({
    email,
    accountVerified: true,
    role: "Admin",
  });

  if (isRegistered) {
    return next(new ErrorHandler("User already registered", 400));
  }

  // 4. Validate password length
  if (password.length < 8 || password.length > 20) {
    return next(
      new ErrorHandler("Password must be between 8 and 20 characters", 400)
    );
  }

  // 5. Validate avatar format
  const { avatar } = req.files;
  const allowedFormats = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedFormats.includes(avatar.mimetype)) {
    return next(new ErrorHandler("Please upload a valid image format", 400));
  }

  // 6. Upload avatar to Cloudinary
  const cloudinaryResponse = await cloudinary.uploader.upload(
    avatar.tempFilePath,
    {
      folder: "uploads",
    }
  );

  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error("Cloudinary Error:", cloudinaryResponse.error || "Unknown error");
    return next(new ErrorHandler("Failed to upload image to Cloudinary", 500));
  }

  // 7. Hash password and create Admin user
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await User.create({
    name,
    email,
    password: hashedPassword,
    avatar: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
    role: "Admin",
    accountVerified: true,
  });

  // 8. Respond to client
  res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    admin,
  });
});
