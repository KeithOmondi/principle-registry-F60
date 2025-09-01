import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { catchAsyncErrors } from "./catchAsyncErrors.js";
import ErrorHandler from "./errorMiddlewares.js";

export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler(401, "Please log in to access this resource."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return next(new ErrorHandler(401, "User no longer exists."));
    }

    next();
  } catch (err) {
    return next(new ErrorHandler(401, "Invalid or expired token."));
  }
});

export const isAuthorized = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          403,
          `Role '${req.user.role}' is not allowed to access this resource.`
        )
      );
    }
    next(); // ✅ Call next() if authorized
  };
};

