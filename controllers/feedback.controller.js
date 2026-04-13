const Feedback = require("../models/Feedback.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");
const resolveGarageId = require("../utils/resolveGarageId");

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/feedbacks?page=1&limit=50
// ─────────────────────────────────────────────────────────────────
const listFeedbacks = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { page = 1, limit = 50 } = req.query;
  const safePage  = Math.max(Number(page)  || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const skip = (safePage - 1) * safeLimit;

  const filter = { garageId, isDeleted: false };

  const [feedbacks, total] = await Promise.all([
    Feedback.find(filter)
      .populate("customerId", "fullName phoneNo")
      .populate("repairOrderId", "orderNo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Feedback.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Feedbacks fetched.", { feedbacks, total, page: safePage });
});

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/feedbacks/stats
// ─────────────────────────────────────────────────────────────────
const getFeedbackStats = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const [result] = await Feedback.aggregate([
    { $match: { garageId, isDeleted: false } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        total:     { $sum: 1 },
      },
    },
  ]);

  return sendSuccess(res, 200, "Feedback stats fetched.", {
    avgRating:    result ? parseFloat(result.avgRating.toFixed(1)) : 0,
    totalReviews: result?.total ?? 0,
  });
});

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/feedbacks
// ─────────────────────────────────────────────────────────────────
const createFeedback = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { customerId, repairOrderId, rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5)
    return sendError(res, 400, "rating must be between 1 and 5.");

  const feedback = await Feedback.create({
    garageId,
    customerId:    customerId   || null,
    repairOrderId: repairOrderId || null,
    rating:        Number(rating),
    comment:       comment?.trim() || "",
  });

  return sendSuccess(res, 201, "Feedback created.", { feedback });
});

// ─────────────────────────────────────────────────────────────────
//  DELETE /api/v1/feedbacks/:id
// ─────────────────────────────────────────────────────────────────
const deleteFeedback = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const feedback = await Feedback.findOne({ _id: req.params.id, garageId, isDeleted: false });
  if (!feedback) return sendError(res, 404, "Feedback not found.");

  feedback.isDeleted = true;
  await feedback.save();

  return sendSuccess(res, 200, "Feedback deleted.");
});

module.exports = { listFeedbacks, getFeedbackStats, createFeedback, deleteFeedback };
