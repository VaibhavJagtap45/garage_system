const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder.model");
const StockIn      = require("../models/StockIn.model");
const Inventory    = require("../models/Inventry.model");
const Invoice      = require("../models/Invoice.model");
const RepairOrder  = require("../models/RepairOrder.model");
const Garage       = require("../models/Garage.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

async function resolveGarageId(user) {
  if (user.role === "owner") {
    const g = await Garage.findOne({ owner: user._id }).select("_id").lean();
    return g?._id ?? null;
  }
  return user.garage ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/accounts-payable
//  Returns vendors with outstanding purchase orders (draft/sent) and
//  customers with unpaid/partial invoices, both grouped with totals.
// ─────────────────────────────────────────────────────────────────────────────
const accountsPayable = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  // ── Vendor payables from purchase orders (draft / sent = not yet received) ──
  const vendorAgg = await PurchaseOrder.aggregate([
    {
      $match: {
        garageId: new mongoose.Types.ObjectId(garageId),
        status:   { $in: ["draft", "sent"] },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id:        "$vendorId",
        totalDue:   { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
        orders: {
          $push: {
            _id:       "$_id",
            orderNo:   "$orderNo",
            status:    "$status",
            amount:    "$totalAmount",
            createdAt: "$createdAt",
          },
        },
      },
    },
    {
      $lookup: {
        from:         "users",
        localField:   "_id",
        foreignField: "_id",
        as:           "vendor",
      },
    },
    { $unwind: { path: "$vendor", preserveNullAndEmpty: true } },
    {
      $project: {
        vendorId:   "$_id",
        vendorName: { $ifNull: ["$vendor.fullName", "Unknown Vendor"] },
        phoneNo:    { $ifNull: ["$vendor.phoneNo", ""] },
        totalDue:   1,
        orderCount: 1,
        orders:     1,
      },
    },
    { $sort: { totalDue: -1 } },
  ]);

  // ── Customer payables from invoices (unpaid / partial) ───────────────────
  const customerAgg = await Invoice.aggregate([
    {
      $match: {
        garageId:      new mongoose.Types.ObjectId(garageId),
        paymentStatus: { $in: ["unpaid", "partial"] },
        isDeleted:     false,
      },
    },
    {
      $addFields: {
        balanceDue: {
          $subtract: [
            { $ifNull: ["$totalAmount", 0] },
            { $ifNull: ["$paidAmount", 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id:           "$customerId",
        totalDue:      { $sum: "$balanceDue" },
        invoiceCount:  { $sum: 1 },
        invoices: {
          $push: {
            _id:           "$_id",
            invoiceNo:     "$invoiceNo",
            paymentStatus: "$paymentStatus",
            totalAmount:   "$totalAmount",
            paidAmount:    "$paidAmount",
            balanceDue:    "$balanceDue",
            createdAt:     "$createdAt",
          },
        },
      },
    },
    {
      $lookup: {
        from:         "users",
        localField:   "_id",
        foreignField: "_id",
        as:           "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmpty: true } },
    {
      $project: {
        customerId:   "$_id",
        customerName: { $ifNull: ["$customer.fullName", "Unknown Customer"] },
        phoneNo:      { $ifNull: ["$customer.phoneNo", ""] },
        totalDue:     1,
        invoiceCount: 1,
        invoices:     1,
      },
    },
    { $sort: { totalDue: -1 } },
  ]);

  const vendorTotal   = vendorAgg.reduce((s, v) => s + v.totalDue, 0);
  const customerTotal = customerAgg.reduce((s, c) => s + c.totalDue, 0);

  return sendSuccess(res, 200, "Accounts payable fetched.", {
    vendors:       vendorAgg,
    customers:     customerAgg,
    vendorTotal,
    customerTotal,
    grandTotal:    vendorTotal + customerTotal,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/stock-in?dateFrom=&dateTo=&vendorId=&page=1&limit=50
//  Inward stock movements with summary totals.
// ─────────────────────────────────────────────────────────────────────────────
const stockInReport = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { dateFrom, dateTo, vendorId, page = 1, limit = 50 } = req.query;
  const safePage  = Math.max(Number(page)  || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const match = { garageId: new mongoose.Types.ObjectId(garageId), isDeleted: false };

  if (dateFrom || dateTo) {
    match.date = {};
    if (dateFrom) match.date.$gte = new Date(dateFrom);
    if (dateTo)   match.date.$lte = new Date(dateTo);
  }
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
    match.vendorId = new mongoose.Types.ObjectId(vendorId);
  }

  const [records, total, statsArr, partsBreakdown] = await Promise.all([
    StockIn.find(match)
      .populate("vendorId", "fullName phoneNo")
      .populate("purchaseOrderId", "orderNo")
      .sort({ date: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    StockIn.countDocuments(match),
    StockIn.aggregate([
      { $match: match },
      {
        $group: {
          _id:         null,
          totalAmount: { $sum: "$totalAmount" },
          totalPaid:   { $sum: "$paidAmount" },
          itemsCount:  { $sum: { $size: "$items" } },
        },
      },
    ]),
    // ── Flat parts list: all items received in the period, grouped by part ──
    StockIn.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id:        { $ifNull: ["$items.inventoryId", "$items.partName"] },
          partName:   { $first: "$items.partName" },
          partCode:   { $first: "$items.partCode" },
          totalQty:   { $sum: "$items.quantityAdded" },
          totalValue: { $sum: "$items.lineTotal" },
          unitPrice:  { $avg: "$items.purchasePrice" },
          entryCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id:        0,
          partName:   1,
          partCode:   1,
          totalQty:   1,
          totalValue: { $round: ["$totalValue", 2] },
          unitPrice:  { $round: ["$unitPrice", 2] },
          entryCount: 1,
        },
      },
      { $sort: { totalValue: -1 } },
    ]),
  ]);

  const stats = statsArr[0] ?? { totalAmount: 0, totalPaid: 0, itemsCount: 0 };

  return sendSuccess(res, 200, "Stock-in report fetched.", {
    records,
    total,
    page:          safePage,
    totalAmount:   stats.totalAmount,
    totalPaid:     stats.totalPaid,
    totalPending:  stats.totalAmount - stats.totalPaid,
    itemsCount:    stats.itemsCount,
    partsBreakdown,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/stock-out?dateFrom=&dateTo=&page=1&limit=50
//  Parts consumed from Repair Orders (physical stock-out event).
//  Returns:
//    records   — parts grouped by inventoryId with totalQty, unitPrice, totalValue
//    byOrder   — per-RO breakdown with each part line (name, qty, unitPrice, total)
//    summary   — totalValue, totalQty, uniqueParts
// ─────────────────────────────────────────────────────────────────────────────
const stockOutReport = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { dateFrom, dateTo, page = 1, limit = 50 } = req.query;
  const safePage  = Math.max(Number(page)  || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const roMatch = {
    garageId:   new mongoose.Types.ObjectId(garageId),
    isDeleted:  false,
    status:     { $nin: ["cancelled"] },
    "parts.0":  { $exists: true },      // only ROs that have parts
  };
  if (dateFrom || dateTo) {
    roMatch.createdAt = {};
    if (dateFrom) roMatch.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   roMatch.createdAt.$lte = new Date(dateTo);
  }

  const [partsAgg, summaryAgg, byOrder] = await Promise.all([

    // ── Parts grouped by inventoryId (paginated) ──────────────────────────
    RepairOrder.aggregate([
      { $match: roMatch },
      { $unwind: { path: "$parts", preserveNullAndEmpty: false } },
      {
        $group: {
          _id:        "$parts.inventoryId",
          partName:   { $first: "$parts.name" },
          partCode:   { $first: "$parts.partCode" },
          totalQty:   { $sum: "$parts.quantity" },
          totalValue: { $sum: "$parts.lineTotal" },
          unitPrice:  { $avg: "$parts.unitPrice" },
          roSet:      { $addToSet: "$_id" },
        },
      },
      {
        $lookup: {
          from:         "inventories",
          localField:   "_id",
          foreignField: "_id",
          as:           "inv",
        },
      },
      {
        $project: {
          inventoryId:    "$_id",
          partName:       { $ifNull: [{ $arrayElemAt: ["$inv.partName", 0] }, "$partName"] },
          partCode:       { $ifNull: [{ $arrayElemAt: ["$inv.partCode", 0] }, "$partCode"] },
          category:       { $ifNull: [{ $arrayElemAt: ["$inv.category", 0] }, "general"] },
          quantityInHand: { $ifNull: [{ $arrayElemAt: ["$inv.quantityInHand", 0] }, 0] },
          totalQty:       1,
          totalValue:     { $round: ["$totalValue", 2] },
          unitPrice:      { $round: ["$unitPrice", 2] },
          orderCount:     { $size: "$roSet" },
        },
      },
      { $sort: { totalValue: -1 } },
      { $skip:  (safePage - 1) * safeLimit },
      { $limit: safeLimit },
    ]),

    // ── Summary totals ─────────────────────────────────────────────────────
    RepairOrder.aggregate([
      { $match: roMatch },
      { $unwind: { path: "$parts", preserveNullAndEmpty: false } },
      {
        $group: {
          _id:         null,
          totalQty:    { $sum: "$parts.quantity" },
          totalValue:  { $sum: "$parts.lineTotal" },
          uniqueParts: { $addToSet: "$parts.inventoryId" },
        },
      },
    ]),

    // ── Per-RO breakdown (last 100 orders with parts) ──────────────────────
    RepairOrder.find(roMatch, {
      orderNo:   1,
      createdAt: 1,
      status:    1,
      parts:     1,
      customerId:1,
    })
      .populate("customerId", "fullName phoneNo")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const summary = summaryAgg[0] ?? { totalQty: 0, totalValue: 0, uniqueParts: [] };

  return sendSuccess(res, 200, "Stock-out report fetched.", {
    records:     partsAgg,
    byOrder,
    page:        safePage,
    totalValue:  parseFloat((summary.totalValue || 0).toFixed(2)),
    totalQty:    summary.totalQty,
    uniqueParts: summary.uniqueParts.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/parts-sales?period=day|month&dateFrom=&dateTo=
//  Sales patterns grouped by day or month.
// ─────────────────────────────────────────────────────────────────────────────
const partsSalesReport = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { period = "day", dateFrom, dateTo } = req.query;
  const groupByMonth = period === "month";

  const invoiceMatch = {
    garageId:  new mongoose.Types.ObjectId(garageId),
    isDeleted: false,
  };
  if (dateFrom || dateTo) {
    invoiceMatch.createdAt = {};
    if (dateFrom) invoiceMatch.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   invoiceMatch.createdAt.$lte = new Date(dateTo);
  }

  // Time-series: revenue per day or month
  const timeSeriesAgg = await Invoice.aggregate([
    { $match: invoiceMatch },
    { $unwind: { path: "$parts", preserveNullAndEmpty: false } },
    {
      $group: {
        _id: groupByMonth
          ? {
              year:  { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            }
          : {
              year:  { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day:   { $dayOfMonth: "$createdAt" },
            },
        revenue: { $sum: "$parts.lineTotal" },
        qty:     { $sum: "$parts.quantity" },
        txns:    { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id:    0,
        period: "$_id",
        revenue: 1,
        qty:     1,
        txnCount: { $size: "$txns" },
      },
    },
    { $sort: { "period.year": 1, "period.month": 1, "period.day": 1 } },
  ]);

  // Top 10 parts by revenue
  const topPartsAgg = await Invoice.aggregate([
    { $match: invoiceMatch },
    { $unwind: { path: "$parts", preserveNullAndEmpty: false } },
    {
      $group: {
        _id:      "$parts.inventoryId",
        partName: { $first: "$parts.name" },
        revenue:  { $sum: "$parts.lineTotal" },
        qty:      { $sum: "$parts.quantity" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $project: {
        inventoryId: "$_id",
        partName:    1,
        revenue:     1,
        qty:         1,
      },
    },
  ]);

  // Overall summary
  const summaryAgg = await Invoice.aggregate([
    { $match: invoiceMatch },
    { $unwind: { path: "$parts", preserveNullAndEmpty: false } },
    {
      $group: {
        _id:         null,
        totalRevenue: { $sum: "$parts.lineTotal" },
        totalQty:     { $sum: "$parts.quantity" },
        uniqueParts:  { $addToSet: "$parts.inventoryId" },
      },
    },
  ]);

  const summary = summaryAgg[0] ?? { totalRevenue: 0, totalQty: 0, uniqueParts: [] };

  return sendSuccess(res, 200, "Parts sales report fetched.", {
    period:       period,
    timeSeries:   timeSeriesAgg,
    topParts:     topPartsAgg,
    totalRevenue: summary.totalRevenue,
    totalQty:     summary.totalQty,
    uniqueParts:  summary.uniqueParts.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/inventory-ageing
//  Categorises inventory by lastUsedAt:
//    active  = used within 30 days
//    slow    = 30–90 days
//    dead    = >90 days or never used
// ─────────────────────────────────────────────────────────────────────────────
const inventoryAgeing = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const now        = new Date();
  const d30        = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const d90        = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const items = await Inventory.find({
    garageId,
    isActive:        true,
    manageInventory: true,
  })
    .select("partName partCode category brand quantityInHand purchasePrice sellingPrice lastUsedAt lastPurchasedAt minimumStockLevel")
    .sort({ lastUsedAt: 1 })
    .lean();

  const active = [];
  const slow   = [];
  const dead   = [];

  for (const item of items) {
    const lu = item.lastUsedAt ? new Date(item.lastUsedAt) : null;
    const stockValue = (item.quantityInHand || 0) * (item.purchasePrice || 0);
    const enriched = { ...item, stockValue };

    if (!lu || lu < d90) {
      dead.push(enriched);
    } else if (lu < d30) {
      slow.push(enriched);
    } else {
      active.push(enriched);
    }
  }

  const totalValue = (arr) => arr.reduce((s, i) => s + (i.stockValue || 0), 0);
  const ageingTotalValue = totalValue(active) + totalValue(slow) + totalValue(dead);

  return sendSuccess(res, 200, "Inventory ageing report fetched.", {
    active:      { items: active,  count: active.length,  value: totalValue(active) },
    slow:        { items: slow,    count: slow.length,    value: totalValue(slow) },
    dead:        { items: dead,    count: dead.length,    value: totalValue(dead) },
    totalItems:  items.length,
    totalValue:  ageingTotalValue,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reports/gst?dateFrom=&dateTo=
//  GST collected from parts used in repair orders (taxPercent > 0).
//  Returns: summary totals, breakdown by tax slab, monthly trend,
//           weekly trend (last 8 weeks in range), top 10 parts by GST.
//
//  Tax formula:  gstAmount = parts.lineTotal × parts.taxPercent / 100
//  (lineTotal is stored pre-tax; tax is additive on top)
// ─────────────────────────────────────────────────────────────────────────────
const gstReport = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { dateFrom, dateTo } = req.query;

  const match = {
    garageId:  new mongoose.Types.ObjectId(garageId),
    isDeleted: false,
    "parts.0": { $exists: true },   // has at least one part
  };
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   match.createdAt.$lte = new Date(dateTo);
  }

  // ── Shared pipeline stages used by every aggregation ──────────────────────
  const unwindTaxedParts = [
    { $match: match },
    { $unwind: "$parts" },
    { $match: { "parts.taxPercent": { $gt: 0 } } },
    {
      $addFields: {
        gstLine:      { $multiply: ["$parts.lineTotal", { $divide: ["$parts.taxPercent", 100] }] },
        taxableBase:  "$parts.lineTotal",
        taxPct:       "$parts.taxPercent",
        partName:     "$parts.name",
        inventoryId:  "$parts.inventoryId",
      },
    },
  ];

  const [summaryArr, bySlabs, monthly, weekly, topParts] = await Promise.all([

    // ── 1. Overall summary ──────────────────────────────────────────────────
    RepairOrder.aggregate([
      ...unwindTaxedParts,
      {
        $group: {
          _id:          null,
          totalGst:     { $sum: "$gstLine" },
          totalTaxable: { $sum: "$taxableBase" },
          orders:       { $addToSet: "$_id" },
        },
      },
    ]),

    // ── 2. Breakdown by GST slab (5%, 12%, 18%, 28% …) ────────────────────
    RepairOrder.aggregate([
      ...unwindTaxedParts,
      {
        $group: {
          _id:          "$taxPct",
          gstAmount:    { $sum: "$gstLine" },
          taxableAmount:{ $sum: "$taxableBase" },
          lineCount:    { $sum: 1 },
        },
      },
      {
        $project: {
          _id:          0,
          taxPercent:   "$_id",
          gstAmount:    { $round: ["$gstAmount", 2] },
          taxableAmount:{ $round: ["$taxableAmount", 2] },
          lineCount:    1,
        },
      },
      { $sort: { taxPercent: 1 } },
    ]),

    // ── 3. Monthly trend ────────────────────────────────────────────────────
    RepairOrder.aggregate([
      ...unwindTaxedParts,
      {
        $group: {
          _id: {
            year:  { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          gstAmount:    { $sum: "$gstLine" },
          taxableAmount:{ $sum: "$taxableBase" },
          orderCount:   { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id:          0,
          year:         "$_id.year",
          month:        "$_id.month",
          gstAmount:    { $round: ["$gstAmount", 2] },
          taxableAmount:{ $round: ["$taxableAmount", 2] },
          orderCount:   { $size: "$orderCount" },
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]),

    // ── 4. Weekly trend ─────────────────────────────────────────────────────
    RepairOrder.aggregate([
      ...unwindTaxedParts,
      {
        $group: {
          _id: {
            year: { $isoWeekYear: "$createdAt" },
            week: { $isoWeek: "$createdAt" },
          },
          gstAmount:    { $sum: "$gstLine" },
          taxableAmount:{ $sum: "$taxableBase" },
          orderCount:   { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id:          0,
          year:         "$_id.year",
          week:         "$_id.week",
          gstAmount:    { $round: ["$gstAmount", 2] },
          taxableAmount:{ $round: ["$taxableAmount", 2] },
          orderCount:   { $size: "$orderCount" },
        },
      },
      { $sort: { year: 1, week: 1 } },
    ]),

    // ── 5. Top 10 parts by GST collected ────────────────────────────────────
    RepairOrder.aggregate([
      ...unwindTaxedParts,
      {
        $group: {
          _id:          "$inventoryId",
          partName:     { $first: "$partName" },
          taxPercent:   { $first: "$taxPct" },
          gstAmount:    { $sum: "$gstLine" },
          taxableAmount:{ $sum: "$taxableBase" },
          totalQty:     { $sum: "$parts.quantity" },
        },
      },
      { $sort: { gstAmount: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id:          0,
          inventoryId:  "$_id",
          partName:     1,
          taxPercent:   1,
          gstAmount:    { $round: ["$gstAmount", 2] },
          taxableAmount:{ $round: ["$taxableAmount", 2] },
          totalQty:     1,
        },
      },
    ]),
  ]);

  const s = summaryArr[0] ?? { totalGst: 0, totalTaxable: 0, orders: [] };

  return sendSuccess(res, 200, "GST report fetched.", {
    summary: {
      totalGst:     parseFloat((s.totalGst    || 0).toFixed(2)),
      totalTaxable: parseFloat((s.totalTaxable|| 0).toFixed(2)),
      totalOrders:  (s.orders || []).length,
    },
    bySlabs,
    monthly,
    weekly,
    topParts,
  });
});

module.exports = {
  accountsPayable,
  stockInReport,
  stockOutReport,
  partsSalesReport,
  inventoryAgeing,
  gstReport,
};
