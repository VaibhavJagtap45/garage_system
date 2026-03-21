const User = require("../models/User.model");
const Garage = require("../models/Garage.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");
const Vehicle = require("../models/Vehicle.model");
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
// ADD USER -> Only owner can add users  -> role: customer → vehicle details can be added at the same time
//  Route : POST /api/v1/user/add-user
const addUser = asyncHandler(async (req, res) => {
  // ── 1. Gate: only owners may add users ─────────────────────────
  if (req.user.role !== "owner") {
    return sendError(res, 403, "Access denied. Only owners can add users.");
  }

  const {
    // User fields
    phoneNo,
    emailId,
    fullName,
    role,
    address,
    // Vehicle fields (customer only)
    vehicleBrand,
    vehicleModel,
    vehicleRegisterNo,
    vehiclePurchaseDate,
    vehicleEngineNo,
    vehicleVinNo,
    vehicleInsuranceProvider,
    vehiclePolicyNo,
    vehicleInsuranceExpire,
    vehicleRegCertificate,
    vehicleInsuranceDoc,
  } = req.body;

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

  // ── 3. Create user ──────────────────────────────────────────────
  const newUser = await User.create({
    phoneNo: phoneNo ?? null,
    emailId: emailId ? emailId.toLowerCase() : null,
    fullName: fullName ?? null,
    address: address ?? null,
    role,
    isVerified: true,
  });

  // ── 4. If customer — optionally create vehicle too ──────────────
  let vehicle = null;

  if (role === "customer" && vehicleBrand && vehicleModel) {
    // Duplicate registration number check
    if (vehicleRegisterNo) {
      const existingVehicle = await Vehicle.findOne({
        vehicleRegisterNo,
      }).lean();
      if (existingVehicle) {
        // User is already created — rollback
        await User.findByIdAndDelete(newUser._id);
        return sendError(
          res,
          409,
          "A vehicle with this registration number already exists. User was not saved.",
        );
      }
    }

    vehicle = await Vehicle.create({
      user: newUser._id,
      vehicleBrand,
      vehicleModel,
      vehicleRegisterNo,
      vehiclePurchaseDate,
      vehicleEngineNo,
      vehicleVinNo,
      vehicleInsuranceProvider,
      vehiclePolicyNo,
      vehicleInsuranceExpire,
      vehicleRegCertificate,
      vehicleInsuranceDoc,
    });
  }

  return sendSuccess(res, 201, "User added successfully", {
    user: newUser,
    ...(vehicle && { vehicle }), // only included if vehicle was created
  });
});

module.exports = { getProfile, addUser };
