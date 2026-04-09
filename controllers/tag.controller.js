const Tag = require("../models/Tag.model");
const Garage = require("../models/Garage.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");

async function resolveGarageId(user) {
  if (user.role === "owner") {
    const g = await Garage.findOne({ owner: user._id }).select("_id").lean();
    return g?._id ?? null;
  }
  return user.garage ?? null;
}

// GET /api/v1/tags?type=invoice|repair_order|both
const listTags = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const filter = { garageId, isDeleted: false };
  if (req.query.type && req.query.type !== "all") filter.tagType = { $in: [req.query.type, "both"] };
  if (req.query.active === "true") filter.isActive = true;

  const tags = await Tag.find(filter).sort({ name: 1 }).lean();
  return sendSuccess(res, 200, "Tags fetched.", { tags });
});

// POST /api/v1/tags
const createTag = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const { name, color, tagType } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Tag name is required.");

  const existing = await Tag.findOne({ garageId, name: name.trim(), isDeleted: false });
  if (existing) return sendError(res, 409, `Tag "${name}" already exists.`);

  const tag = await Tag.create({
    garageId,
    name: name.trim(),
    color: color || "#111111",
    tagType: tagType || "both",
    createdBy: req.user._id,
  });
  return sendSuccess(res, 201, "Tag created.", { tag });
});

// PUT /api/v1/tags/:id
const updateTag = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const tag = await Tag.findOne({ _id: req.params.id, garageId, isDeleted: false });
  if (!tag) return sendError(res, 404, "Tag not found.");

  const { name, color, tagType, isActive } = req.body;
  if (name !== undefined) tag.name = name.trim();
  if (color !== undefined) tag.color = color;
  if (tagType !== undefined) tag.tagType = tagType;
  if (isActive !== undefined) tag.isActive = isActive;

  await tag.save();
  return sendSuccess(res, 200, "Tag updated.", { tag });
});

// DELETE /api/v1/tags/:id
const deleteTag = asyncHandler(async (req, res) => {
  const garageId = await resolveGarageId(req.user);
  if (!garageId) return sendError(res, 404, "Garage not found.");

  const tag = await Tag.findOne({ _id: req.params.id, garageId, isDeleted: false });
  if (!tag) return sendError(res, 404, "Tag not found.");

  tag.isDeleted = true;
  await tag.save();
  return sendSuccess(res, 200, "Tag deleted.");
});

module.exports = { listTags, createTag, updateTag, deleteTag };
