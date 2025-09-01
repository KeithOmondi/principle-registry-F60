import express from "express";
import { isAuthenticated, isAuthorized } from "../middlewares/authMiddleware.js";
import { getAllUsers, registerNewAdmin } from "../controller/userController.js";

const router = express.Router();

router.get("/all", isAuthenticated, isAuthorized("Admin"), getAllUsers);
router.get(
  "/add/new-admin",
  isAuthenticated,
  isAuthorized("Admin"),
  registerNewAdmin
);

export default router;
