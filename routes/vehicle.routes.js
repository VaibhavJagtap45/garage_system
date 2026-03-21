const router = require("express").Router();
const protect = require("../middlewares/auth");
const {
  addBrand,
  addModel,
  getMetaBrands,
  getMetaModelsByBrand,
} = require("../controllers/vehicleMeta.controller");

// ── All routes require authentication ─────────────────────────────
router.use(protect);

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/vehicle/brand ->  Body: { brand: "Honda", models: ["Activa", "Shine"] }
router.post("/brand", addBrand);

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/vehicle/model->  Body: { brand: "Honda", model: "CB300R" }
router.post("/model", addModel);

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/vehicle-meta/brands->   Returns all brands list
router.get("/brands", getMetaBrands);

// ─────────────────────────────────────────────────────────────────
//  GET /api/v1/vehicle/models?brand=Honda
router.get("/models", getMetaModelsByBrand);

module.exports = router;
