const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Garage = require("../models/Garage.model");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/admin/login
// ─────────────────────────────────────────────────────────────────
const adminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (username !== "admin" || password !== "admin") {
    return sendError(res, 401, "Invalid credentials.");
  }

  const token = jwt.sign(
    { role: "superadmin", username: "admin" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "24h" }
  );

  return sendSuccess(res, 200, "Login successful", { token });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/admin/garages  — list with optional ?status= filter
// ─────────────────────────────────────────────────────────────────
const getAllGarages = asyncHandler(async (req, res) => {
  const { status } = req.query;

  // Garages created before approvalStatus was added have the field missing (undefined).
  // Treat those as "pending" so they surface in the approval queue.
  const VALID_STATUSES = ["pending", "approved", "rejected"];
  let filter = {};
  if (status && VALID_STATUSES.includes(status)) {
    filter =
      status === "pending"
        ? { $or: [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }] }
        : { approvalStatus: status };
  }

  const rawGarages = await Garage.find(filter)
    .populate("owner", "fullName phoneNo emailId isVerified createdAt")
    .sort({ createdAt: -1 })
    .lean();

  // Normalise missing field in-memory so the frontend always gets a clean string
  const garages = rawGarages.map((g) => ({
    ...g,
    approvalStatus: g.approvalStatus || "pending",
  }));

  return sendSuccess(res, 200, "Garages fetched", { garages });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/admin/garages/stats
// ─────────────────────────────────────────────────────────────────
const getGarageStats = asyncHandler(async (req, res) => {
  // Old docs may have no approvalStatus field — count them as pending
  const pendingFilter = {
    $or: [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
  };

  const [total, pending, approved, rejected] = await Promise.all([
    Garage.countDocuments(),
    Garage.countDocuments(pendingFilter),
    Garage.countDocuments({ approvalStatus: "approved" }),
    Garage.countDocuments({ approvalStatus: "rejected" }),
  ]);

  return sendSuccess(res, 200, "Stats fetched", { total, pending, approved, rejected });
});

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/admin/garages  — create garage (no OTP, admin only)
//
//  Body: garage fields + owner fields (fullName, phoneNo, emailId)
//  Creates a verified User + Garage in one transaction.
// ─────────────────────────────────────────────────────────────────
const createGarage = asyncHandler(async (req, res) => {
  const {
    // Owner / user fields
    fullName,
    phoneNo,
    emailId,
    // Garage fields
    garageName,
    garageOwnerName,
    garageAddress,
    garageContactNumber,
    garageType,
    garageLogo,
    state,
    isGstApplicable,
    gstNumber,
    approvalStatus = "approved",
  } = req.body;

  if (!phoneNo) return sendError(res, 400, "Owner phone number is required.");

  // Prevent duplicate phone
  const existingUser = await User.findOne({ phoneNo });
  if (existingUser) {
    return sendError(res, 409, `A user with phone ${phoneNo} already exists.`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create owner user — isVerified: true, bypass OTP entirely
    const [user] = await User.create(
      [
        {
          fullName: fullName || null,
          phoneNo,
          emailId: emailId || undefined,
          isVerified: true,
          role: "owner",
          state: state || null,
        },
      ],
      { session }
    );

    // Create garage linked to that user
    const [garage] = await Garage.create(
      [
        {
          owner: user._id,
          garageName,
          garageOwnerName,
          garageAddress,
          garageContactNumber,
          garageType,
          garageLogo: garageLogo || null,
          state: state || null,
          isGstApplicable: !!isGstApplicable,
          gstNumber: isGstApplicable ? (gstNumber || null) : null,
          isProfileComplete: true,
          approvalStatus,
        },
      ],
      { session }
    );

    // Link garage back to user
    await User.findByIdAndUpdate(user._id, { garage: garage._id }, { session });

    await session.commitTransaction();

    const populated = await Garage.findById(garage._id)
      .populate("owner", "fullName phoneNo emailId isVerified")
      .lean();

    return sendSuccess(res, 201, "Garage created successfully", { garage: populated });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ─────────────────────────────────────────────────────────────────
//  PUT /api/v1/admin/garages/:id  — update garage (+ its owner)
// ─────────────────────────────────────────────────────────────────
const updateGarage = asyncHandler(async (req, res) => {
  const garage = await Garage.findById(req.params.id);
  if (!garage) return sendError(res, 404, "Garage not found.");

  const {
    // Owner fields
    fullName,
    emailId,
    // Garage fields
    garageName,
    garageOwnerName,
    garageAddress,
    garageContactNumber,
    garageType,
    garageLogo,
    state,
    isGstApplicable,
    gstNumber,
    approvalStatus,
  } = req.body;

  // Update owner user (only safe fields — never change phoneNo here)
  const userUpdate = {};
  if (fullName !== undefined) userUpdate.fullName = fullName;
  if (emailId !== undefined) userUpdate.emailId = emailId || undefined;
  if (state !== undefined) userUpdate.state = state;

  if (Object.keys(userUpdate).length > 0) {
    await User.findByIdAndUpdate(garage.owner, userUpdate, { runValidators: true });
  }

  // Build garage update payload
  const garageUpdate = {};
  if (garageName !== undefined) garageUpdate.garageName = garageName;
  if (garageOwnerName !== undefined) garageUpdate.garageOwnerName = garageOwnerName;
  if (garageAddress !== undefined) garageUpdate.garageAddress = garageAddress;
  if (garageContactNumber !== undefined) garageUpdate.garageContactNumber = garageContactNumber;
  if (garageType !== undefined) garageUpdate.garageType = garageType;
  if (garageLogo !== undefined) garageUpdate.garageLogo = garageLogo;
  if (state !== undefined) garageUpdate.state = state;
  if (approvalStatus !== undefined) garageUpdate.approvalStatus = approvalStatus;

  if (isGstApplicable !== undefined) {
    garageUpdate.isGstApplicable = !!isGstApplicable;
    garageUpdate.gstNumber = isGstApplicable ? (gstNumber || null) : null;
  }

  const updated = await Garage.findByIdAndUpdate(
    req.params.id,
    { $set: garageUpdate },
    { new: true, runValidators: true }
  ).populate("owner", "fullName phoneNo emailId isVerified");

  return sendSuccess(res, 200, "Garage updated successfully", { garage: updated });
});

// ─────────────────────────────────────────────────────────────────
//  DELETE /api/v1/admin/garages/:id
//  Removes the garage document and its owner user.
// ─────────────────────────────────────────────────────────────────
const deleteGarage = asyncHandler(async (req, res) => {
  const garage = await Garage.findById(req.params.id);
  if (!garage) return sendError(res, 404, "Garage not found.");

  await Promise.all([
    Garage.findByIdAndDelete(req.params.id),
    User.findByIdAndDelete(garage.owner),
  ]);

  return sendSuccess(res, 200, "Garage deleted successfully");
});

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/v1/admin/garages/:id/approve
// ─────────────────────────────────────────────────────────────────
const approveGarage = asyncHandler(async (req, res) => {
  const garage = await Garage.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: "approved" },
    { new: true }
  ).populate("owner", "fullName phoneNo emailId");

  if (!garage) return sendError(res, 404, "Garage not found.");
  return sendSuccess(res, 200, "Garage approved", { garage });
});

// ─────────────────────────────────────────────────────────────────
//  PATCH /api/v1/admin/garages/:id/reject
// ─────────────────────────────────────────────────────────────────
const rejectGarage = asyncHandler(async (req, res) => {
  const garage = await Garage.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: "rejected" },
    { new: true }
  ).populate("owner", "fullName phoneNo emailId");

  if (!garage) return sendError(res, 404, "Garage not found.");
  return sendSuccess(res, 200, "Garage rejected", { garage });
});

module.exports = {
  adminLogin,
  getAllGarages,
  getGarageStats,
  createGarage,
  updateGarage,
  deleteGarage,
  approveGarage,
  rejectGarage,
};
