// const RepairOrder = require("../models/RepairOrder.model");
// const Vehicle = require("../models/Vehicle.model");
// const User = require("../models/User.model");
// const Garage = require("../models/Garage.model");
// const asyncHandler = require("../utils/asyncHandler");
// const { sendSuccess, sendError } = require("../utils/response.utils");

// // ─── Helper ───────────────────────────────────────────────────────
// async function resolveGarageId(user) {
//   if (user.role === "owner") {
//     const g = await Garage.findOne({ owner: user._id }).select("_id").lean();
//     return g?._id ?? null;
//   }
//   return user.garage ?? null;
// }

// async function nextOrderNo(garageId) {
//   const count = await RepairOrder.countDocuments({ garageId });
//   return `RO-${String(count + 1).padStart(5, "0")}`;
// }

// // ─────────────────────────────────────────────────────────────────
// //  GET /api/v1/repair-orders/search-vehicle?regNo=MH12AB1234
// //  Returns vehicle + customer info for the given registration number
// // ─────────────────────────────────────────────────────────────────
// const searchVehicleByRegNo = asyncHandler(async (req, res) => {
//   const { regNo } = req.query;
//   if (!regNo?.trim())
//     return sendError(res, 400, "regNo query param is required.");

//   const vehicle = await Vehicle.findOne({
//     vehicleRegisterNo: { $regex: new RegExp(`^${regNo.trim()}$`, "i") },
//   }).lean();

//   if (!vehicle)
//     return sendError(
//       res,
//       404,
//       `No vehicle found with registration "${regNo}".`,
//     );

//   const customer = await User.findById(vehicle.user)
//     .select("fullName phoneNo emailId role")
//     .lean();

//   return sendSuccess(res, 200, "Vehicle found.", { vehicle, customer });
// });

// // ─────────────────────────────────────────────────────────────────
// //  GET /api/v1/repair-orders?status=&page=&limit=
// // ─────────────────────────────────────────────────────────────────
// const listRepairOrders = asyncHandler(async (req, res) => {
//   const garageId = await resolveGarageId(req.user);
//   if (!garageId) return sendError(res, 404, "Garage not found.");

//   const { status, page = 1, limit = 50, search } = req.query;
//   const filter = { garageId, isDeleted: false };
//   if (status) filter.status = status;

//   const safePage = Math.max(Number(page) || 1, 1);
//   const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
//   const skip = (safePage - 1) * safeLimit;

//   const [orders, total] = await Promise.all([
//     RepairOrder.find(filter)
//       .populate("customerId", "fullName phoneNo")
//       .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(safeLimit)
//       .lean(),
//     RepairOrder.countDocuments(filter),
//   ]);

//   return sendSuccess(res, 200, "Repair orders fetched.", {
//     orders,
//     total,
//     page: safePage,
//   });
// });

// // ─────────────────────────────────────────────────────────────────
// //  GET /api/v1/repair-orders/:id
// // ─────────────────────────────────────────────────────────────────
// const getRepairOrder = asyncHandler(async (req, res) => {
//   const garageId = await resolveGarageId(req.user);
//   if (!garageId) return sendError(res, 404, "Garage not found.");

//   const order = await RepairOrder.findOne({
//     _id: req.params.id,
//     garageId,
//     isDeleted: false,
//   })
//     .populate("customerId", "fullName phoneNo emailId")
//     .populate(
//       "vehicleId",
//       "vehicleBrand vehicleModel vehicleRegisterNo vehicleVariant",
//     )
//     .lean();

//   if (!order) return sendError(res, 404, "Repair order not found.");
//   return sendSuccess(res, 200, "Repair order fetched.", { order });
// });

// // ─────────────────────────────────────────────────────────────────
// //  POST /api/v1/repair-orders
// // ─────────────────────────────────────────────────────────────────
// const createRepairOrder = asyncHandler(async (req, res) => {
//   const garageId = await resolveGarageId(req.user);
//   if (!garageId) return sendError(res, 404, "Garage not found.");

//   const {
//     customerId,
//     vehicleId,
//     odometerReading,
//     vehicleVariant,
//     services = [],
//     applyDiscountToAllServices = false,
//     parts = [],
//     applyDiscountToAllParts = false,
//     images = [],
//     laborTotal = 0,
//     partsTotal = 0,
//     taxTotal = 0,
//     totalAmount = 0,
//     discountAmount = 0,
//     tags = [],
//     customerRemarks = [],
//     estimatedDeliveryAt,
//     notifyCustomer = false,
//   } = req.body;

//   if (!customerId) return sendError(res, 400, "customerId is required.");
//   if (!vehicleId) return sendError(res, 400, "vehicleId is required.");

//   const orderNo = await nextOrderNo(garageId);

//   const order = await RepairOrder.create({
//     garageId,
//     orderNo,
//     customerId,
//     vehicleId,
//     odometerReading: odometerReading ?? null,
//     vehicleVariant: vehicleVariant ?? null,
//     services,
//     applyDiscountToAllServices,
//     parts,
//     applyDiscountToAllParts,
//     images,
//     laborTotal: Number(laborTotal) || 0,
//     partsTotal: Number(partsTotal) || 0,
//     taxTotal: Number(taxTotal) || 0,
//     totalAmount: Number(totalAmount) || 0,
//     discountAmount: Number(discountAmount) || 0,
//     tags,
//     customerRemarks,
//     estimatedDeliveryAt: estimatedDeliveryAt
//       ? new Date(estimatedDeliveryAt)
//       : null,
//     notifyCustomer,
//     createdBy: req.user._id,
//     status: "created",
//   });

//   return sendSuccess(res, 201, "Repair order created.", { order });
// });

// // ─────────────────────────────────────────────────────────────────
// //  PUT /api/v1/repair-orders/:id
// // ─────────────────────────────────────────────────────────────────
// const updateRepairOrder = asyncHandler(async (req, res) => {
//   const garageId = await resolveGarageId(req.user);
//   if (!garageId) return sendError(res, 404, "Garage not found.");

//   const order = await RepairOrder.findOne({
//     _id: req.params.id,
//     garageId,
//     isDeleted: false,
//   });
//   if (!order) return sendError(res, 404, "Repair order not found.");

//   const allowed = [
//     "services",
//     "applyDiscountToAllServices",
//     "parts",
//     "applyDiscountToAllParts",
//     "images",
//     "laborTotal",
//     "partsTotal",
//     "taxTotal",
//     "totalAmount",
//     "discountAmount",
//     "tags",
//     "customerRemarks",
//     "estimatedDeliveryAt",
//     "notifyCustomer",
//     "status",
//     "odometerReading",
//     "vehicleVariant",
//   ];

//   allowed.forEach((k) => {
//     if (req.body[k] !== undefined) order[k] = req.body[k];
//   });

//   await order.save();
//   return sendSuccess(res, 200, "Repair order updated.", { order });
// });

// // ─────────────────────────────────────────────────────────────────
// //  DELETE /api/v1/repair-orders/:id  (soft delete)
// // ─────────────────────────────────────────────────────────────────
// const deleteRepairOrder = asyncHandler(async (req, res) => {
//   const garageId = await resolveGarageId(req.user);
//   if (!garageId) return sendError(res, 404, "Garage not found.");

//   const order = await RepairOrder.findOneAndUpdate(
//     { _id: req.params.id, garageId, isDeleted: false },
//     { isDeleted: true },
//     { new: true },
//   );

//   if (!order) return sendError(res, 404, "Repair order not found.");
//   return sendSuccess(res, 200, "Repair order deleted.");
// });

// module.exports = {
//   searchVehicleByRegNo,
//   listRepairOrders,
//   getRepairOrder,
//   createRepairOrder,
//   updateRepairOrder,
//   deleteRepairOrder,
// };

const RepairOrder = require("../models/RepairOrder.model");
const Vehicle = require("../models/Vehicle.model");
const User = require("../models/User.model");
const Garage = require("../models/Garage.model");
const { sendWhatsApp } = require("../utils/whatsapp");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

// ─── Helper ───────────────────────────────────────────────────────
async function resolveGarageId(user) {
  if (user.role === "owner") {
    const g = await Garage.findOne({ owner: user._id }).select("_id").lean();
    return g?._id ?? null;
  }
  return user.garage ?? null;
}

async function nextOrderNo(garageId) {
  // Find the actual highest orderNo for this garage — safe against deletions and
  // concurrent inserts (unlike countDocuments which drifts when rows are removed).
  const last = await RepairOrder.findOne(
    { garageId, orderNo: { $exists: true, $ne: null } },
    { orderNo: 1 },
    { sort: { orderNo: -1 } },
  ).lean();
  const lastNum = last?.orderNo ? parseInt(last.orderNo.replace(/\D/g, ""), 10) || 0 : 0;
  return `RO-${String(lastNum + 1).padStart(5, "0")}`;
}

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/search-customers?q=John
//  Live search: matches by customer name/phone OR vehicle reg number.
//  Returns up to 20 { customer, vehicle } pairs for the dropdown list.
// ─────────────────────────────────────────────────────────────────
const searchCustomers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim() || q.trim().length < 2) {
    return sendSuccess(res, 200, "Results.", { results: [] });
  }

  const rx = new RegExp(q.trim(), "i");

  // 1. Find customers matching name/phone  AND  vehicles matching reg number — parallel
  const [matchingCustomers, matchingVehiclesByReg] = await Promise.all([
    User.find({ $or: [{ fullName: rx }, { phoneNo: rx }] })
      .select("_id fullName phoneNo emailId")
      .limit(15)
      .lean(),
    Vehicle.find({ vehicleRegisterNo: rx })
      .select("_id vehicleBrand vehicleModel vehicleRegisterNo user")
      .limit(10)
      .lean(),
  ]);

  // 2. Collect all unique customer IDs from both result sets
  const customerIdSet = new Set(matchingCustomers.map((c) => String(c._id)));
  for (const v of matchingVehiclesByReg) {
    if (v.user) customerIdSet.add(String(v.user));
  }

  if (customerIdSet.size === 0) {
    return sendSuccess(res, 200, "Results.", { results: [] });
  }

  // 3. Fetch all those customers and ALL their vehicles in 2 parallel queries
  const allCustomerIds = [...customerIdSet];
  const [allCustomers, allVehicles] = await Promise.all([
    User.find({ _id: { $in: allCustomerIds } })
      .select("_id fullName phoneNo emailId")
      .lean(),
    Vehicle.find({ user: { $in: allCustomerIds } })
      .select("_id vehicleBrand vehicleModel vehicleRegisterNo user")
      .lean(),
  ]);

  // 4. Build lookup maps
  const customerMap = {};
  allCustomers.forEach((c) => { customerMap[String(c._id)] = c; });

  const vehiclesByCustomer = {};
  allVehicles.forEach((v) => {
    const cid = String(v.user);
    if (!vehiclesByCustomer[cid]) vehiclesByCustomer[cid] = [];
    vehiclesByCustomer[cid].push({ ...v, user: undefined });
  });

  // 5. Build one result row per customer-vehicle pair
  const results = [];
  for (const cid of allCustomerIds) {
    const customer = customerMap[cid];
    if (!customer) continue;
    const vehicles = vehiclesByCustomer[cid] ?? [];
    if (vehicles.length === 0) {
      results.push({ customer, vehicle: null });
    } else {
      for (const v of vehicles) {
        results.push({ customer, vehicle: v });
      }
    }
  }

  return sendSuccess(res, 200, "Results.", { results: results.slice(0, 20) });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/search-vehicle?regNo=MH12AB1234
//  Returns vehicle + customer info for the given registration number
// ─────────────────────────────────────────────────────────────────
const searchVehicleByRegNo = asyncHandler(async (req, res) => {
  const { regNo } = req.query;
  if (!regNo?.trim())
    return sendError(res, 400, "regNo query param is required.");

  const vehicles = await Vehicle.find({
    vehicleRegisterNo: { $regex: new RegExp(regNo.trim(), "i") },
  }).limit(20).lean();

  if (!vehicles.length)
    return sendError(
      res,
      404,
      `No vehicle found with registration "${regNo}".`,
    );

  const results = await Promise.all(
    vehicles.map(async (vehicle) => {
      const customer = await User.findById(vehicle.user)
        .select("fullName phoneNo emailId role")
        .lean();
      return { vehicle, customer };
    }),
  );

  return sendSuccess(res, 200, "Vehicles found.", { results });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders?status=&page=&limit=
// ─────────────────────────────────────────────────────────────────
const listRepairOrders = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { status, page = 1, limit = 50, search } = req.query;
  const filter = { garageId, isDeleted: false };
  if (status) filter.status = status;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const skip = (safePage - 1) * safeLimit;

  // ── Text search: match on orderNo, customer name/phone, vehicle reg ──────────
  // We do this in two passes:
  // 1. If search term looks like a reg no or order no, add direct filter
  // 2. For name/phone, find matching customer IDs first, then filter by those
  if (search?.trim()) {
    const q = search.trim();
    const rx = new RegExp(q, "i");

    // Find customers matching name or phone
    const matchingCustomers = await User.find({
      $or: [{ fullName: rx }, { phoneNo: rx }],
    })
      .select("_id")
      .lean();

    const customerIds = matchingCustomers.map((u) => u._id);

    // Find vehicles matching reg number
    const matchingVehicles = await Vehicle.find({
      vehicleRegisterNo: rx,
    })
      .select("_id")
      .lean();

    const vehicleIds = matchingVehicles.map((v) => v._id);

    filter.$or = [
      { orderNo: rx },
      ...(customerIds.length ? [{ customerId: { $in: customerIds } }] : []),
      ...(vehicleIds.length ? [{ vehicleId: { $in: vehicleIds } }] : []),
    ];
  }

  const [orders, total] = await Promise.all([
    RepairOrder.find(filter)
      .populate("customerId", "fullName phoneNo")
      .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    RepairOrder.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Repair orders fetched.", {
    orders,
    total,
    page: safePage,
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/:id
// ─────────────────────────────────────────────────────────────────
const getRepairOrder = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const order = await RepairOrder.findOne({
    _id: req.params.id,
    garageId,
    isDeleted: false,
  })
    .populate("customerId", "fullName phoneNo emailId")
    .populate(
      "vehicleId",
      "vehicleBrand vehicleModel vehicleRegisterNo vehicleVariant",
    )
    .lean();

  if (!order) return sendError(res, 404, "Repair order not found.");
  return sendSuccess(res, 200, "Repair order fetched.", { order });
});

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/repair-orders
// ─────────────────────────────────────────────────────────────────
const createRepairOrder = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const {
    customerId,
    vehicleId,
    odometerReading,
    vehicleVariant,
    services = [],
    applyDiscountToAllServices = false,
    parts = [],
    applyDiscountToAllParts = false,
    images = [],
    laborTotal = 0,
    partsTotal = 0,
    taxTotal = 0,
    totalAmount = 0,
    discountAmount = 0,
    tags = [],
    customerRemarks = [],
    scheduledAt,
    estimatedDeliveryAt,
    notifyCustomer = false,
  } = req.body;

  if (!customerId) return sendError(res, 400, "customerId is required.");
  if (!vehicleId) return sendError(res, 400, "vehicleId is required.");

  const payload = {
    garageId,
    customerId,
    vehicleId,
    odometerReading: odometerReading ?? null,
    vehicleVariant: vehicleVariant ?? null,
    services,
    applyDiscountToAllServices,
    parts,
    applyDiscountToAllParts,
    images,
    laborTotal: Number(laborTotal) || 0,
    partsTotal: Number(partsTotal) || 0,
    taxTotal: Number(taxTotal) || 0,
    totalAmount: Number(totalAmount) || 0,
    discountAmount: Number(discountAmount) || 0,
    tags,
    customerRemarks,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    estimatedDeliveryAt: estimatedDeliveryAt ? new Date(estimatedDeliveryAt) : null,
    notifyCustomer,
    createdBy: req.user._id,
    status: "created",
  };

  // Retry up to 5 times on duplicate orderNo (handles concurrent requests).
  // Each retry re-queries the max orderNo so it always picks the next free slot.
  let order;
  for (let attempt = 0; attempt < 5; attempt++) {
    payload.orderNo = await nextOrderNo(garageId);
    try {
      order = await RepairOrder.create(payload);
      break;
    } catch (err) {
      if (err.code === 11000 && attempt < 4) continue; // duplicate key — retry
      throw err;
    }
  }

  return sendSuccess(res, 201, "Repair order created.", { order });
});

// ─────────────────────────────────────────────────────────────────
//  PUT /api/v1/repair-orders/:id
// ─────────────────────────────────────────────────────────────────
const updateRepairOrder = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const order = await RepairOrder.findOne({
    _id: req.params.id,
    garageId,
    isDeleted: false,
  });
  if (!order) return sendError(res, 404, "Repair order not found.");

  const allowed = [
    "services",
    "applyDiscountToAllServices",
    "parts",
    "applyDiscountToAllParts",
    "images",
    "laborTotal",
    "partsTotal",
    "taxTotal",
    "totalAmount",
    "discountAmount",
    "tags",
    "customerRemarks",
    "scheduledAt",         // advance booking date — editable by owner
    "estimatedDeliveryAt",
    "notifyCustomer",
    "status",
    "odometerReading",
    "vehicleVariant",
    "assignedTo",          // owner assigns a mechanic (member)
    "assignedAt",
  ];

  const previousStatus = order.status;

  allowed.forEach((k) => {
    if (req.body[k] !== undefined) order[k] = req.body[k];
  });

  await order.save();

  // ── Auto WhatsApp notification on vehicle_ready ──────────────────
  if (
    req.body.status === "vehicle_ready" &&
    previousStatus !== "vehicle_ready"
  ) {
    // Fire-and-forget — don't block the response
    (async () => {
      try {
        const [garage, customer] = await Promise.all([
          Garage.findById(garageId).select("preferences garageName").lean(),
          order.customerId
            ? User.findById(order.customerId).select("fullName phoneNo").lean()
            : null,
        ]);

        if (garage?.preferences?.autoWaNotification && customer?.phoneNo) {
          const gName = garage.garageName ?? "Your garage";
          const cName = customer.fullName ?? "Customer";
          const roNo  = order.orderNo ?? "your repair order";
          const msg =
            `Hi ${cName}! 🚗\n\n` +
            `Your vehicle is ready for pickup at *${gName}*.\n` +
            `Repair Order: *${roNo}*\n\n` +
            `Please visit us at your earliest convenience. Thank you!`;

          await sendWhatsApp(customer.phoneNo, msg);
        }
      } catch (err) {
        console.error("[WA Notify] Error:", err.message);
      }
    })();
  }

  return sendSuccess(res, 200, "Repair order updated.", { order });
});

// ─────────────────────────────────────────────────────────────────
//  DELETE /api/v1/repair-orders/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────
const deleteRepairOrder = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const order = await RepairOrder.findOneAndUpdate(
    { _id: req.params.id, garageId, isDeleted: false },
    { isDeleted: true },
    { new: true },
  );

  if (!order) return sendError(res, 404, "Repair order not found.");
  return sendSuccess(res, 200, "Repair order deleted.");
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/cancelled?page=&limit=&dateFrom=&dateTo=
// ─────────────────────────────────────────────────────────────────
const getCancelledOrders = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { page = 1, limit = 20, dateFrom, dateTo, search } = req.query;
  const safePage  = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = { garageId, isDeleted: false, status: "cancelled" };

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  if (search?.trim()) {
    const rx = new RegExp(search.trim(), "i");
    const matchingCustomers = await User.find({ $or: [{ fullName: rx }, { phoneNo: rx }] }).select("_id").lean();
    filter.$or = [{ orderNo: rx }, { customerId: { $in: matchingCustomers.map(c => c._id) } }];
  }

  const [orders, total] = await Promise.all([
    RepairOrder.find(filter)
      .populate("customerId", "fullName phoneNo")
      .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    RepairOrder.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Cancelled orders fetched.", { orders, total, page: safePage });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/tally-export?dateFrom=&dateTo=
//  Returns structured data for Tally export (JSON, frontend converts to CSV)
// ─────────────────────────────────────────────────────────────────
const tallyExport = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) return sendError(res, 400, "dateFrom and dateTo are required.");

  const filter = {
    garageId,
    isDeleted: false,
    status: { $nin: ["cancelled"] },
    createdAt: {
      $gte: new Date(dateFrom),
      $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)),
    },
  };

  const orders = await RepairOrder.find(filter)
    .populate("customerId", "fullName phoneNo emailId")
    .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
    .sort({ createdAt: 1 })
    .lean();

  const rows = orders.map(o => ({
    orderNo:         o.orderNo ?? "",
    date:            o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "",
    customerName:    o.customerId?.fullName ?? "",
    customerPhone:   o.customerId?.phoneNo ?? "",
    vehicleRegNo:    o.vehicleId?.vehicleRegisterNo ?? "",
    vehicle:         o.vehicleId ? `${o.vehicleId.vehicleBrand ?? ""} ${o.vehicleId.vehicleModel ?? ""}`.trim() : "",
    status:          o.status ?? "",
    labourTotal:     o.laborTotal ?? 0,
    partsTotal:      o.partsTotal ?? 0,
    discountAmount:  o.discountAmount ?? 0,
    taxTotal:        o.taxTotal ?? 0,
    totalAmount:     o.totalAmount ?? 0,
    paymentMode:     o.paymentMode ?? "cash",
  }));

  return sendSuccess(res, 200, "Tally export data.", { rows, total: rows.length, dateFrom, dateTo });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/repair-orders/garage-members
//  Returns all member-role users linked to the owner's garage
//  (used by the owner to pick a mechanic when assigning an order)
// ─────────────────────────────────────────────────────────────────
const getGarageMembers = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const members = await User.find({ garage: garageId, role: "member" })
    .select("fullName phoneNo")
    .sort({ fullName: 1 })
    .lean();

  return sendSuccess(res, 200, "Members fetched.", { members });
});

module.exports = {
  searchCustomers,
  searchVehicleByRegNo,
  listRepairOrders,
  getRepairOrder,
  createRepairOrder,
  updateRepairOrder,
  deleteRepairOrder,
  getCancelledOrders,
  tallyExport,
  getGarageMembers,
};
