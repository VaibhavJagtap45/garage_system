const Invoice = require("../models/Invoice.model");
const RepairOrder = require("../models/RepairOrder.model");
const Garage = require("../models/Garage.model");
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

async function nextInvoiceNo(garageId) {
  const count = await Invoice.countDocuments({ garageId });
  return `INV-${String(count + 1).padStart(5, "0")}`;
}

// ─── Compute totals from lines ────────────────────────────────────
function computeTotals(
  services,
  parts,
  labourPercent = 20,
  discountAmount = 0,
) {
  const servicesSubTotal = services.reduce(
    (s, line) => s + (line.lineTotal ?? 0),
    0,
  );
  const partsSubTotal = parts.reduce((s, line) => s + (line.lineTotal ?? 0), 0);
  const labourCharge = parseFloat(
    (servicesSubTotal * (labourPercent / 100)).toFixed(2),
  );
  const taxAmount =
    services.reduce((s, l) => {
      const base = l.lineTotal ?? 0;
      return s + parseFloat((base * ((l.taxPercent ?? 0) / 100)).toFixed(2));
    }, 0) +
    parts.reduce((s, l) => {
      const base = (l.unitPrice ?? 0) * (l.quantity ?? 1) - (l.discount ?? 0);
      return s + parseFloat((base * ((l.taxPercent ?? 0) / 100)).toFixed(2));
    }, 0);

  const totalAmount = parseFloat(
    (
      servicesSubTotal +
      partsSubTotal +
      labourCharge +
      taxAmount -
      discountAmount
    ).toFixed(2),
  );

  return {
    servicesSubTotal,
    partsSubTotal,
    labourCharge,
    taxAmount,
    totalAmount,
  };
}

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/invoices?status=&customerId=&page=&limit=&search=
// ─────────────────────────────────────────────────────────────────
const listInvoices = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { status, customerId, repairOrderId, paymentStatus, dateFrom, dateTo, search, page = 1, limit = 20 } = req.query;
  const filter = { garageId, isDeleted: false };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  if (repairOrderId) filter.repairOrderId = repairOrderId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(dateTo);
  }

  // Full-text search: match invoice number OR customers by name/phone
  if (search && search.trim()) {
    const User = require("../models/User.model");
    const rx = new RegExp(search.trim(), "i");
    const matchingCustomers = await User.find({
      $or: [{ fullName: rx }, { phoneNo: rx }],
    })
      .select("_id")
      .lean();
    filter.$or = [
      { invoiceNo: rx },
      { customerId: { $in: matchingCustomers.map((c) => c._id) } },
    ];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate("customerId", "fullName phoneNo emailId")
      .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Invoices fetched.", {
    invoices,
    total,
    page: safePage,
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/invoices/:id
// ─────────────────────────────────────────────────────────────────
const getInvoice = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const invoice = await Invoice.findOne({
    _id: req.params.id,
    garageId,
    isDeleted: false,
  })
    .populate("customerId", "fullName phoneNo emailId")
    .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
    .populate("repairOrderId", "orderNo status")
    .lean();

  if (!invoice) return sendError(res, 404, "Invoice not found.");
  return sendSuccess(res, 200, "Invoice fetched.", { invoice });
});

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/invoices
//  Supports prefill from a repairOrderId
// ─────────────────────────────────────────────────────────────────
const createInvoice = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  let {
    repairOrderId = null,
    customerId = null,
    vehicleId = null,
    services = [],
    parts = [],
    tags = [],
    labourPercent = 20,
    discountAmount = 0,
    notifyCustomer = false,
    notes = null,
    paymentMode = "cash",
  } = req.body;

  // If coming from a repair order — prefill from it
  if (repairOrderId) {
    const ro = await RepairOrder.findOne({
      _id: repairOrderId,
      garageId,
    }).lean();
    if (!ro) return sendError(res, 404, "Repair order not found.");

    // Only prefill fields not explicitly supplied
    if (!customerId) customerId = ro.customerId;
    if (!vehicleId) vehicleId = ro.vehicleId;
    if (!services.length) services = ro.services ?? [];
    if (!parts.length) parts = ro.parts ?? [];
    if (!tags.length) tags = ro.tags ?? [];
  }

  if (!customerId) return sendError(res, 400, "customerId is required.");

  // Recompute line totals in case frontend sent raw prices without lineTotal
  const normalizedServices = services.map((s) => ({
    ...s,
    lineTotal: s.lineTotal ?? (s.price ?? 0) - (s.discount ?? 0),
  }));
  const normalizedParts = parts.map((p) => ({
    ...p,
    lineTotal:
      p.lineTotal ?? (p.unitPrice ?? 0) * (p.quantity ?? 1) - (p.discount ?? 0),
  }));

  const totals = computeTotals(
    normalizedServices,
    normalizedParts,
    Number(labourPercent) || 20,
    Number(discountAmount) || 0,
  );

  const invoiceNo = await nextInvoiceNo(garageId);

  const created = await Invoice.create({
    garageId,
    invoiceNo,
    repairOrderId: repairOrderId || null,
    customerId,
    vehicleId: vehicleId || null,
    services: normalizedServices,
    parts: normalizedParts,
    tags,
    ...totals,
    labourPercent: Number(labourPercent) || 20,
    discountAmount: Number(discountAmount) || 0,
    notifyCustomer,
    notes: notes?.trim() || null,
    paymentMode,
    createdBy: req.user._id,
    status: "draft",
  });

  // Populate so the frontend can display customer & vehicle immediately
  const invoice = await Invoice.findById(created._id)
    .populate("customerId", "fullName phoneNo emailId")
    .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
    .lean();

  return sendSuccess(res, 201, "Invoice created.", { invoice });
});

// ─────────────────────────────────────────────────────────────────
//  PUT /api/v1/invoices/:id
// ─────────────────────────────────────────────────────────────────
const updateInvoice = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const invoice = await Invoice.findOne({
    _id: req.params.id,
    garageId,
    isDeleted: false,
  });
  if (!invoice) return sendError(res, 404, "Invoice not found.");

  const { services, parts, labourPercent, discountAmount, ...rest } = req.body;

  // If line items changed — recompute totals
  if (services !== undefined || parts !== undefined) {
    const newServices = services ?? invoice.services;
    const newParts = parts ?? invoice.parts;
    const lp = Number(labourPercent ?? invoice.labourPercent) || 20;
    const dis = Number(discountAmount ?? invoice.discountAmount) || 0;

    const totals = computeTotals(newServices, newParts, lp, dis);
    Object.assign(invoice, {
      services: newServices,
      parts: newParts,
      labourPercent: lp,
      discountAmount: dis,
      ...totals,
    });
  }

  const allowed = [
    "tags",
    "notifyCustomer",
    "notes",
    "paymentMode",
    "paymentStatus",
    "status",
    "customerId",
    "vehicleId",
  ];
  allowed.forEach((k) => {
    if (rest[k] !== undefined) invoice[k] = rest[k];
  });

  await invoice.save();

  // Always return populated refs so frontend can display customer/vehicle name
  const populated = await Invoice.findById(invoice._id)
    .populate("customerId", "fullName phoneNo emailId")
    .populate("vehicleId", "vehicleBrand vehicleModel vehicleRegisterNo")
    .populate("repairOrderId", "orderNo status")
    .lean();

  return sendSuccess(res, 200, "Invoice updated.", { invoice: populated });
});

// ─────────────────────────────────────────────────────────────────
//  DELETE /api/v1/invoices/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────
const deleteInvoice = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, garageId, isDeleted: false },
    { isDeleted: true },
    { new: true },
  );

  if (!invoice) return sendError(res, 404, "Invoice not found.");
  return sendSuccess(res, 200, "Invoice deleted.");
});

// GET /api/v1/invoices/stats?dateFrom=&dateTo=
const getInvoiceStats = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { dateFrom, dateTo } = req.query;
  const filter = { garageId, isDeleted: false };
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(dateTo);
  }

  const [result] = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total:  { $sum: "$totalAmount" },
        paid:   { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } },
        credit: { $sum: { $cond: [{ $eq: ["$paymentStatus", "unpaid"] }, "$totalAmount", 0] } },
      },
    },
  ]);

  return sendSuccess(res, 200, "Invoice stats fetched.", {
    total:  result?.total  ?? 0,
    paid:   result?.paid   ?? 0,
    credit: result?.credit ?? 0,
  });
});

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
};
