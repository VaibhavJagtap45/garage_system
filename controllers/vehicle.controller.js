const VehicleMeta = require("../models/VehicleMeta.model");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");
// ─────────────────────────────────────────────────────────────────
//  Route : POST /api/v1/vehicle/brand
const addBrand = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner") {
    return sendError(res, 403, "Only owners can manage vehicle brands.");
  }

  const { brand, models = [] } = req.body;

  if (!brand) {
    return sendError(res, 400, "brand is required.");
  }

  // Upsert — if brand exists, merge new models in
  const existing = await VehicleMeta.findOne({
    brand: { $regex: new RegExp(`^${brand}$`, "i") },
  });

  if (existing) {
    // Add only new models that don't already exist (case-insensitive)
    const existingLower = existing.models.map((m) => m.toLowerCase());
    const newModels = models.filter(
      (m) => !existingLower.includes(m.toLowerCase()),
    );

    if (newModels.length === 0) {
      return sendError(
        res,
        409,
        "Brand already exists with all provided models.",
      );
    }

    existing.models.push(...newModels);
    await existing.save();

    return sendSuccess(res, 200, "Models added to existing brand.", {
      vehicleMeta: existing,
    });
  }

  const vehicleMeta = await VehicleMeta.create({ brand, models });

  return sendSuccess(res, 201, "Brand added successfully.", { vehicleMeta });
});

// ─────────────────────────────────────────────────────────────────
//  ADD MODEL TO EXISTING BRAND ->   Route : POST /api/v1/vehicle/model
const addModel = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner") {
    return sendError(res, 403, "Only owners can manage vehicle models.");
  }

  const { brand, model } = req.body;

  if (!brand || !model) {
    return sendError(res, 400, "brand and model are required.");
  }

  const vehicleMeta = await VehicleMeta.findOne({
    brand: { $regex: new RegExp(`^${brand}$`, "i") },
  });

  if (!vehicleMeta) {
    return sendError(
      res,
      404,
      `Brand "${brand}" not found. Add the brand first.`,
    );
  }

  const alreadyExists = vehicleMeta.models.some(
    (m) => m.toLowerCase() === model.toLowerCase(),
  );

  if (alreadyExists) {
    return sendError(
      res,
      409,
      `Model "${model}" already exists under "${brand}".`,
    );
  }

  vehicleMeta.models.push(model);
  await vehicleMeta.save();

  return sendSuccess(res, 200, "Model added successfully.", { vehicleMeta });
});

// ─────────────────────────────────────────────────────────────────
//  GET ALL BRANDS ->   Route : GET /api/v1/vehicle/brands
const getMetaBrands = asyncHandler(async (req, res) => {
  const brands = await VehicleMeta.find({}, "brand").sort({ brand: 1 }).lean();

  return sendSuccess(res, 200, "Brands fetched successfully.", {
    total: brands.length,
    brands: brands.map((b) => b.brand),
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET MODELS BY BRAND ->  Route : GET /api/v1/vehicle/models?brand=Honda
const getMetaModelsByBrand = asyncHandler(async (req, res) => {
  const { brand } = req.query;

  if (!brand) {
    return sendError(res, 400, "brand query param is required.");
  }

  const vehicleMeta = await VehicleMeta.findOne({
    brand: { $regex: new RegExp(`^${brand}$`, "i") },
  }).lean();

  if (!vehicleMeta) {
    return sendError(res, 404, `Brand "${brand}" not found.`);
  }

  return sendSuccess(res, 200, "Models fetched successfully.", {
    brand: vehicleMeta.brand,
    total: vehicleMeta.models.length,
    models: vehicleMeta.models.sort(),
  });
});

module.exports = {
  getMetaModelsByBrand,
  getMetaBrands,
  addModel,
  addBrand,
};
