// const User = require("../models/User.model");
// const Vehicle = require("../models/Vehicle.model");
// const asyncHandler = require("../utils/asyncHandler");
// const { sendSuccess, sendError } = require("../utils/response.utils");

// // ─────────────────────────────────────────────────────────────────
// //  GET USERS BY ROLE  (list)
// //  GET /api/v1/customers     GET /api/v1/members       GET /api/v1/vendors
// //  Access: Owner only
// const getUsersByRole = asyncHandler(async (req, res) => {
//   if (req.user.role !== "owner") {
//     return sendError(
//       res,
//       403,
//       "Access denied. Only owners can view user lists.",
//     );
//   }

//   // const { role, search } = req.query;
//   // was: const { role, search } = req.query;
//   const role = req.targetRole;
//   const { search } = req.query;

//   const allowedRoles = ["customer", "member", "vendor"];
//   if (!role || !allowedRoles.includes(role)) {
//     return sendError(res, 400, "Invalid role.");
//   }

//   // ── AFTER (role always applied, search is additive) ──
//   const filter = { role };
//   if (search) {
//     filter.$and = [
//       { role },
//       {
//         $or: [
//           { fullName: { $regex: search, $options: "i" } },
//           { phoneNo: { $regex: search, $options: "i" } },
//           { emailId: { $regex: search, $options: "i" } },
//         ],
//       },
//     ];
//     delete filter.role; // avoid duplicate, $and already has it
//   }

//   const users = await User.find(filter)
//     .select("-otp -refreshToken -__v")
//     .sort({ createdAt: -1 })
//     .lean();

//   return sendSuccess(res, 200, `${role}s fetched successfully.`, {
//     total: users.length,
//     users,
//   });
// });

// // ─────────────────────────────────────────────────────────────────
// //  GET USER DETAIL BY ID
// //
// //  customer       → user info + all linked vehicles
// //  member/vendor  → user info only
// //
// //  GET /api/v1/customers/:id
// //  GET /api/v1/members/:id
// //  GET /api/v1/vendors/:id
// //  Access: Owner only
// // ─────────────────────────────────────────────────────────────────
// const getUserDetail = asyncHandler(async (req, res) => {
//   if (req.user.role !== "owner") {
//     return sendError(
//       res,
//       403,
//       "Access denied. Only owners can view user details.",
//     );
//   }

//   const { userId } = req.params;

//   const user = await User.findById(userId)
//     .select("-otp -refreshToken -__v")
//     .lean();

//   if (!user) {
//     return sendError(res, 404, "User not found.");
//   }

//   if (user.role === "customer") {
//     const vehicles = await Vehicle.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .lean();

//     return sendSuccess(res, 200, "Customer details fetched successfully.", {
//       user,
//       vehicles,
//       totalVehicles: vehicles.length,
//     });
//   }

//   return sendSuccess(res, 200, `${user.role} details fetched successfully.`, {
//     user,
//   });
// });

// module.exports = { getUsersByRole, getUserDetail };

const User = require("../models/User.model");
const Garage = require("../models/Garage.model");
const Vehicle = require("../models/Vehicle.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

// ─────────────────────────────────────────────────────────────────
//  GET USERS BY ROLE  (list)
//  GET /api/v1/customers     GET /api/v1/members     GET /api/v1/vendors
//  Access: Owner only — scoped to the owner's garage
// ─────────────────────────────────────────────────────────────────
const getUsersByRole = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner") {
    return sendError(
      res,
      403,
      "Access denied. Only owners can view user lists.",
    );
  }

  const role = req.targetRole;
  const { search } = req.query;

  const allowedRoles = ["customer", "member", "vendor"];
  if (!role || !allowedRoles.includes(role)) {
    return sendError(res, 400, "Invalid role.");
  }

  // ── Find this owner's garage ────────────────────────────────────
  const garage = await Garage.findOne({ owner: req.user._id }).lean();
  if (!garage) {
    return sendSuccess(res, 200, `${role}s fetched successfully.`, {
      total: 0,
      users: [],
    });
  }

  // ── Build filter scoped to this garage ──────────────────────────
  const filter = { role, garage: garage._id };

  if (search) {
    filter.$and = [
      { role },
      { garage: garage._id },
      {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { phoneNo: { $regex: search, $options: "i" } },
          { emailId: { $regex: search, $options: "i" } },
        ],
      },
    ];
    delete filter.role;
    delete filter.garage;
  }

  const users = await User.find(filter)
    .select("-otp -refreshToken -__v")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, 200, `${role}s fetched successfully.`, {
    total: users.length,
    users,
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET USER DETAIL BY ID
//  GET /api/v1/customers/:id   GET /api/v1/members/:id   GET /api/v1/vendors/:id
//  Access: Owner only
// ─────────────────────────────────────────────────────────────────
const getUserDetail = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner") {
    return sendError(
      res,
      403,
      "Access denied. Only owners can view user details.",
    );
  }

  const { userId } = req.params;

  const user = await User.findById(userId)
    .select("-otp -refreshToken -__v")
    .lean();

  if (!user) {
    return sendError(res, 404, "User not found.");
  }

  if (user.role === "customer") {
    const vehicles = await Vehicle.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, 200, "Customer details fetched successfully.", {
      user,
      vehicles,
      totalVehicles: vehicles.length,
    });
  }

  return sendSuccess(res, 200, `${user.role} details fetched successfully.`, {
    user,
  });
});

module.exports = { getUsersByRole, getUserDetail };
