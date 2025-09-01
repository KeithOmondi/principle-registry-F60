import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Don't return password in queries
    },
    role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
    },
    accountVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: Number,
    },
    verificationCodeExpiry: {
      type: Date,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpiry: {
      type: Date,
    },
    avatar: {
      url: { type: String },
      publicId: { type: String },
    },
    borrowedBooks: [
      {
        bookId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Borrow",
        },
        bookTitle: {
          type: String,
          required: true,
        },
        borrowedDate: Date,
        dueDate: Date,
        returned: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generate a 5-digit verification code
userSchema.methods.generateVerificationCode = function () {
  const code = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  this.verificationCode = code;
  this.verificationCodeExpiry = Date.now() + 10 * 60 * 1000; // valid for 10 minutes
  return code;
};

// Generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

  return resetToken;
};



export const User = mongoose.model("User", userSchema);
