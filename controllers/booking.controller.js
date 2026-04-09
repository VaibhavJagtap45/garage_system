const Booking = require("../models/Booking.model");
const Garage = require("../models/Garage.model");
const User = require("../models/User.model");
const Vehicle = require("../models/Vehicle.model");
const RepairOrder = require("../models/RepairOrder.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");
const {
  removeBookingFromOwnerCalendar,
  syncBookingToOwnerCalendar,
} = require("../services/googleCalendar.service");

// ─────────────────────────────────────────────────────────────────────────────
// Helper — get the owner's garage or 404
// ─────────────────────────────────────────────────────────────────────────────
async function ownerGarage(userId) {
  return Garage.findOne({ owner: userId }).lean();
}

function populateBooking(query) {
  return query
    .populate("customer", "fullName phoneNo emailId")
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo");
}

// ─────────────────────────────────────────────────────────────────────────────
//  LIST BOOKINGS  (owner)
//  GET /api/v1/bookings?status=&date=&search=&page=&limit=
//  Access: Owner only, scoped to their garage
// ─────────────────────────────────────────────────────────────────────────────
const listBookings = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const garage = await ownerGarage(req.user._id);
  if (!garage)
    return sendSuccess(res, 200, "Bookings fetched.", { total: 0, bookings: [] });

  const { status, date, search, page = 1, limit = 20 } = req.query;
  const filter = { garage: garage._id };

  if (status && status !== "all") filter.status = status;

  // date filter — match bookings on a specific calendar day (UTC)
  if (date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    filter.scheduledAt = { $gte: start, $lte: end };
  }

  let bookingIds;
  if (search) {
    // find customers matching search, then filter bookings by those customer ids
    const users = await User.find({
      garage: garage._id,
      $or: [
        { fullName: { $regex: search, $options: "i" } },
        { phoneNo: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    bookingIds = users.map((u) => u._id);
    filter.customer = { $in: bookingIds };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("customer", "fullName phoneNo emailId")
      .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
      .lean(),
  ]);

  return sendSuccess(res, 200, "Bookings fetched.", { total, bookings });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE BOOKING  (owner on behalf of customer)
//  POST /api/v1/bookings
//  Body: { customerId, vehicleId?, scheduledAt, duration?, serviceType, notes? }
//  Access: Owner only
// ─────────────────────────────────────────────────────────────────────────────
const createBooking = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const garage = await ownerGarage(req.user._id);
  if (!garage) return sendError(res, 404, "Garage not found.");

  const { customerId, vehicleId, scheduledAt, duration, serviceType, notes } = req.body;

  if (!customerId) return sendError(res, 400, "customerId is required.");
  if (!scheduledAt) return sendError(res, 400, "scheduledAt is required.");

  const customer = await User.findById(customerId).lean();
  if (!customer || String(customer.garage) !== String(garage._id))
    return sendError(res, 404, "Customer not found in your garage.");

  const booking = await Booking.create({
    garage: garage._id,
    customer: customerId,
    ...(vehicleId && { vehicle: vehicleId }),
    scheduledAt: new Date(scheduledAt),
    ...(duration && { duration: Number(duration) }),
    serviceType: serviceType || "",
    notes: notes || "",
    bookedBy: "owner",
    status: "confirmed", // owner-created bookings are auto-confirmed
  });

  let populated = await Booking.findById(booking._id)
    .populate("customer", "fullName phoneNo emailId")
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .lean();

  // Owner-created bookings are auto-confirmed — sync to Google Calendar immediately
  const calendarSync = await syncBookingToOwnerCalendar(populated, { garage });
  if (calendarSync?.googleCalendar) {
    populated = { ...populated, googleCalendar: calendarSync.googleCalendar };
  }

  return sendSuccess(res, 201, "Booking created.", {
    booking: populated,
    ...(calendarSync && { calendarSync }),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET BOOKING DETAIL  (owner)
//  GET /api/v1/bookings/:id
// ─────────────────────────────────────────────────────────────────────────────
const getBookingDetail = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const garage = await ownerGarage(req.user._id);
  const booking = await Booking.findOne({ _id: req.params.id, garage: garage?._id })
    .populate("customer", "fullName phoneNo emailId")
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .populate("repairOrderId", "orderNo status")
    .lean();

  if (!booking) return sendError(res, 404, "Booking not found.");
  return sendSuccess(res, 200, "Booking fetched.", { booking });
});

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE BOOKING STATUS  (owner)
//  PATCH /api/v1/bookings/:id/status
//  Body: { status }  — pending | confirmed | in_progress | completed | cancelled
// ─────────────────────────────────────────────────────────────────────────────
const updateBookingStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const { status } = req.body;
  const allowed = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
  if (!status || !allowed.includes(status))
    return sendError(res, 400, `status must be one of: ${allowed.join(", ")}`);

  const garage = await ownerGarage(req.user._id);
  if (!garage) return sendError(res, 404, "Garage not found.");

  const existing = await Booking.findOne({
    _id: req.params.id,
    garage: garage._id,
  }).lean();

  if (!existing) return sendError(res, 404, "Booking not found.");

  let booking = await populateBooking(
    Booking.findByIdAndUpdate(existing._id, { status }, { new: true }),
  ).lean();

  let calendarSync = null;
  if (status === "confirmed" && existing.status !== "confirmed") {
    calendarSync = await syncBookingToOwnerCalendar(booking, { garage });
  } else if (status === "cancelled" && ["confirmed", "in_progress"].includes(existing.status)) {
    calendarSync = await removeBookingFromOwnerCalendar(existing, { garage });
  }

  if (calendarSync?.googleCalendar) {
    booking = { ...booking, googleCalendar: calendarSync.googleCalendar };
  }

  return sendSuccess(res, 200, "Booking status updated.", {
    booking,
    ...(calendarSync && { calendarSync }),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CONVERT BOOKING → REPAIR ORDER  (owner)
//  POST /api/v1/bookings/:id/convert
//  Access: Owner only
// ─────────────────────────────────────────────────────────────────────────────
const convertToRepairOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const garage = await ownerGarage(req.user._id);
  const booking = await Booking.findOne({
    _id: req.params.id,
    garage: garage?._id,
  }).lean();

  if (!booking) return sendError(res, 404, "Booking not found.");
  if (booking.repairOrderId)
    return sendError(res, 400, "This booking already has a repair order.");
  if (!booking.vehicle)
    return sendError(res, 400, "Booking must have a vehicle to convert to repair order.");

  const ro = await RepairOrder.create({
    garageId: garage._id,
    customerId: booking.customer,
    vehicleId: booking.vehicle,
    customerNote: booking.notes || booking.serviceType || "",
    createdBy: req.user._id,
    status: "created",
  });

  await Booking.findByIdAndUpdate(booking._id, {
    repairOrderId: ro._id,
    status: "in_progress",
  });

  return sendSuccess(res, 201, "Repair order created from booking.", {
    repairOrderId: ro._id,
    orderNo: ro.orderNo,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMER — LIST MY BOOKINGS
//  GET /api/v1/customer/bookings
// ─────────────────────────────────────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ customer: req.user._id })
    .sort({ scheduledAt: -1 })
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .lean();

  return sendSuccess(res, 200, "Bookings fetched.", {
    total: bookings.length,
    bookings,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMER — CREATE BOOKING
//  POST /api/v1/customer/bookings
//  Body: { vehicleId?, scheduledAt, serviceType, notes? }
// ─────────────────────────────────────────────────────────────────────────────
const createMyBooking = asyncHandler(async (req, res) => {
  const { vehicleId, scheduledAt, serviceType, notes } = req.body;

  if (!scheduledAt) return sendError(res, 400, "scheduledAt is required.");
  if (!serviceType) return sendError(res, 400, "serviceType is required.");

  // Find the garage this customer belongs to
  const garage = await Garage.findById(req.user.garage).lean();
  if (!garage) return sendError(res, 404, "Garage not found.");

  const booking = await Booking.create({
    garage: garage._id,
    customer: req.user._id,
    ...(vehicleId && { vehicle: vehicleId }),
    scheduledAt: new Date(scheduledAt),
    serviceType,
    notes: notes || "",
    bookedBy: "customer",
    status: "pending",
  });

  const populated = await Booking.findById(booking._id)
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .lean();

  return sendSuccess(res, 201, "Booking request sent.", { booking: populated });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMER — CANCEL MY BOOKING
//  PATCH /api/v1/customer/bookings/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
const cancelMyBooking = asyncHandler(async (req, res) => {
  const existing = await Booking.findOne({
    _id: req.params.id,
    customer: req.user._id,
    status: { $in: ["pending", "confirmed"] },
  }).lean();

  if (!existing)
    return sendError(res, 404, "Booking not found or cannot be cancelled.");

  let booking = await Booking.findByIdAndUpdate(
    existing._id,
    { status: "cancelled" },
    { new: true },
  ).lean();

  let calendarSync = null;
  if (existing.status === "confirmed") {
    calendarSync = await removeBookingFromOwnerCalendar(existing);
  }

  if (calendarSync?.googleCalendar) {
    booking = { ...booking, googleCalendar: calendarSync.googleCalendar };
  }

  return sendSuccess(res, 200, "Booking cancelled.", {
    booking,
    ...(calendarSync && { calendarSync }),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  LINK REPAIR ORDER TO BOOKING  (owner)
//  PATCH /api/v1/bookings/:id/link-ro
//  Body: { repairOrderId }
//  Called after the RO form is fully submitted from CustomerRepairOrderScreen
// ─────────────────────────────────────────────────────────────────────────────
const linkRepairOrder = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const { repairOrderId } = req.body;
  if (!repairOrderId) return sendError(res, 400, "repairOrderId is required.");

  const garage = await ownerGarage(req.user._id);
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, garage: garage?._id },
    { repairOrderId, status: "in_progress" },
    { new: true },
  )
    .populate("customer", "fullName phoneNo emailId")
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .populate("repairOrderId", "orderNo status")
    .lean();

  if (!booking) return sendError(res, 404, "Booking not found.");
  return sendSuccess(res, 200, "Repair order linked to booking.", { booking });
});

// ─────────────────────────────────────────────────────────────────────────────
//  RETRY GOOGLE CALENDAR SYNC  (owner)
//  POST /api/v1/bookings/:id/calendar-sync
// ─────────────────────────────────────────────────────────────────────────────
const syncBookingCalendar = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner")
    return sendError(res, 403, "Access denied.");

  const garage = await ownerGarage(req.user._id);
  if (!garage) return sendError(res, 404, "Garage not found.");

  let booking = await populateBooking(
    Booking.findOne({ _id: req.params.id, garage: garage._id }),
  ).lean();

  if (!booking) return sendError(res, 404, "Booking not found.");
  if (booking.status !== "confirmed") {
    return sendError(res, 400, "Only confirmed bookings can be synced.");
  }

  const calendarSync = await syncBookingToOwnerCalendar(booking, { garage });
  if (calendarSync?.googleCalendar) {
    booking = { ...booking, googleCalendar: calendarSync.googleCalendar };
  }

  return sendSuccess(
    res,
    200,
    calendarSync.ok
      ? "Booking synced to Google Calendar."
      : "Booking updated, but Google Calendar sync needs attention.",
    { booking, calendarSync },
  );
});

module.exports = {
  listBookings,
  createBooking,
  getBookingDetail,
  updateBookingStatus,
  convertToRepairOrder,
  linkRepairOrder,
  getMyBookings,
  createMyBooking,
  cancelMyBooking,
  syncBookingCalendar,
};
