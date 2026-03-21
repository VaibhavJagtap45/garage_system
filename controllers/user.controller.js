const User = require("../models/User.model");
const Garage = require("../models/Garage.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

// ─────────────────────────────────────────────────────────────────
//  GET PROFILE
//  Route : GET /api/user/profile
//  Access: Protected (Bearer token required)
const getProfile = asyncHandler(async (req, res) => {
  const user = req.user; // already attached & sanitised by `protect` middleware

  // Owner — enrich response with garage details
  if (user.role === "owner") {
    const garage = await Garage.findOne({ owner: user._id }).lean();

    return sendSuccess(res, 200, "Profile fetched successfully", {
      user,
      garage: garage ?? null, // null when owner hasn't completed garage setup yet
    });
  }

  // Customer / Member / Vendor — user info only
  return sendSuccess(res, 200, "Profile fetched successfully", { user });
});

// ─────────────────────────────────────────────────────────────────
//  ADD USER
//  Route : POST /api/user/add-user
//  Access: Protected — owner only
const addUser = asyncHandler(async (req, res) => {
  // ── 1. Gate: only owners may add users ─────────────────────────
  if (req.user.role !== "owner") {
    return sendError(res, 403, "Access denied. Only owners can add users.");
  }

  const { phoneNo, emailId, fullName, role } = req.body;

  // ── 2. Duplicate check ──────────────────────────────────────────
  const orConditions = [];
  if (phoneNo) orConditions.push({ phoneNo });
  if (emailId) orConditions.push({ emailId: emailId.toLowerCase() });

  if (orConditions.length > 0) {
    const existing = await User.findOne({ $or: orConditions }).lean();

    if (existing) {
      const conflict =
        existing.phoneNo === phoneNo ? "phone number" : "email address";
      return sendError(
        res,
        409,
        `A user with this ${conflict} already exists.`,
      );
    }
  }

  // ── 3. Create the new user ──────────────────────────────────────

  const newUser = await User.create({
    phoneNo: phoneNo ?? null,
    emailId: emailId ? emailId.toLowerCase() : null,
    fullName: fullName ?? null,
    role, // already validated by Zod (customer | member | vendor)
    isVerified: true,
  });

  return sendSuccess(res, 201, "User added successfully", { user: newUser });
});

module.exports = { getProfile, addUser };
