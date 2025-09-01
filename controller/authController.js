import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import { sendVerificationCode } from "../utils/sendVerificationCode.js";
import validator from "validator";
import { sendToken } from "../utils/sendToken.js";
import { generateForgotPasswordEmailTemplate } from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/sendMail.js";
import crypto from "crypto";

// REGISTER CONTROLLER
export const register = catchAsyncErrors(async (req, res, next) => {
  const { name, email, password } = req.body;

  // Basic validations
  if (!name || !email || !password) {
    return next(new ErrorHandler(400, "Please provide all required fields."));
  }

  if (!validator.isEmail(email)) {
    return next(new ErrorHandler(400, "Please enter a valid email address."));
  }

  if (password.length < 8 || password.length > 20) {
    return next(
      new ErrorHandler(400, "Password must be between 8 and 20 characters.")
    );
  }

  // Check for existing verified user
  const existingUser = await User.findOne({ email, accountVerified: true });
  if (existingUser) {
    return next(new ErrorHandler(400, "User already exists."));
  }

  // Handle unverified user with cooldown and attempt limits
  const unverifiedUser = await User.findOne({ email, accountVerified: false });

  if (unverifiedUser) {
    const cooldownMs = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    const lastAttempt = unverifiedUser.lastAttemptAt?.getTime() || 0;
    const timeSinceLastAttempt = now - lastAttempt;

    if (
      unverifiedUser.verificationAttempts >= 5 &&
      timeSinceLastAttempt < cooldownMs
    ) {
      return next(
        new ErrorHandler(
          429,
          "Too many registration attempts. Please try again later."
        )
      );
    }

    if (timeSinceLastAttempt >= cooldownMs) {
      unverifiedUser.verificationAttempts = 0;
    }

    await User.deleteMany({ email, accountVerified: false });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = new User({
    name,
    email,
    password: hashedPassword,
    verificationAttempts: 1,
    lastAttemptAt: new Date(),
  });

  // Generate and save verification code
  const code = newUser.generateVerificationCode();
  await newUser.save();

  // Send verification code via email
  await sendVerificationCode(email, code);

  res.status(201).json({
    success: true,
    message:
      "User registered. A verification code has been sent to your email.",
  });
});

// VERIFY OTP CONTROLLER
export const verifyOTP = catchAsyncErrors(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorHandler(400, "Email and OTP are required."));
  }

  const users = await User.find({ email, accountVerified: false }).sort({
    createdAt: -1,
  });

  if (!users || users.length === 0) {
    return next(
      new ErrorHandler(404, "No unverified user found with this email.")
    );
  }

  const user = users[0]; // Latest registration attempt

  // Cleanup older unverified records
  if (users.length > 1) {
    await User.deleteMany({
      _id: { $ne: user._id },
      email,
      accountVerified: false,
    });
  }

  if (user.verificationCode !== Number(otp)) {
    return next(new ErrorHandler(400, "Invalid OTP."));
  }

  const now = Date.now();
  const expiry = new Date(user.verificationCodeExpiry).getTime();

  if (now > expiry) {
    return next(
      new ErrorHandler(400, "OTP has expired. Please request a new one.")
    );
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpiry = null;
  user.verificationAttempts = 0;
  user.lastAttemptAt = null;

  await user.save({ validateModifiedOnly: true });

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully. Please log in.",
  });
});


export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Validate input
  if (!email || !password) {
    return next(
      new ErrorHandler(400, "Please provide both email and password.")
    );
  }

  // 2. Find user and ensure account is verified
  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );

  if (!user) {
    return next(new ErrorHandler(401, "Invalid email or password."));
  }

  // 3. Validate password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return next(new ErrorHandler(401, "Invalid email or password."));
  }

  // 4. Send authentication token
  return sendToken(user, 200, "Login successful", res);
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler(400, "Please provide your email address."));
  }

  const user = await User.findOne({ email, accountVerified: true });

  if (!user) {
    return next(
      new ErrorHandler(404, "User not found or account not verified.")
    );
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
  const emailHtml = generateForgotPasswordEmailTemplate(resetPasswordUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      html: emailHtml,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} with password reset instructions.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    console.error("❌ Email sending failed:", error.message);
    return next(
      new ErrorHandler(500, "Failed to send reset email. Please try again.")
    );
  }
});

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return next(new ErrorHandler(400, "Please provide both password fields."));
  }

  if (password.length < 8 || password.length > 16) {
    return next(
      new ErrorHandler(400, "Password must be between 8 and 16 characters.")
    );
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler(400, "Passwords do not match."));
  }

  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpiry: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorHandler(400, "Invalid or expired reset token."));
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiry = undefined;
  await user.save();

  sendToken(user, 200, "Password reset successful. You can now log in.", res);
});

export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const currentUser = await User.findById(req.user._id).select("+password");
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(new ErrorHandler(400, "Please provide all password fields."));
  }

  const isPasswordMatch = await bcrypt.compare(
    currentPassword,
    currentUser.password
  );
  if (!isPasswordMatch) {
    return next(new ErrorHandler(401, "Current password is incorrect."));
  }

  if (newPassword.length < 8 || newPassword.length > 16) {
    return next(
      new ErrorHandler(400, "Password must be between 8 and 16 characters.")
    );
  }

  if (newPassword !== confirmNewPassword) {
    return next(new ErrorHandler(400, "New passwords do not match."));
  }

  currentUser.password = await bcrypt.hash(newPassword, 10);
  await currentUser.save();

  sendToken(currentUser, 200, "Password updated successfully.", res);

  //const hashedPassword = await bcrypt.hash(newPassword, 10);
  //user.password = hashedPassword;
  //await user.save();
  //res.status(200).json({
  //success: true,
  //message: "Password updated successfully.",
  //})
});
