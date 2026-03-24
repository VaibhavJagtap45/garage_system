// const router = require("express").Router();
// const protect = require("../middlewares/auth");
// const {
//   addVehicle,
//   getVehiclesByUser,
//   getVehicleById,
// } = require("../controllers/vehicle.controller"); // separate controller

// // POST /api/v1/vehicle/add  — add vehicle to existing customer
// router.post("/add", addVehicle);

// // GET /api/v1/vehicle/customer/:customerId  — all vehicles of a customer
// router.get("/customer/:customerId", getVehiclesByUser);

// // GET /api/v1/vehicle/:vehicleId
// router.get("/:vehicleId", getVehicleById);

// // ── All routes require authentication ─────────────────────────────
// router.use(protect);

// // ─────────────────────────────────────────────────────────────────
// //  POST /api/v1/vehicle/brand ->  Body: { brand: "Honda", models: ["Activa", "Shine"] }
// router.post("/brand", addBrand);

// // ─────────────────────────────────────────────────────────────────
// //  POST /api/v1/vehicle/model->  Body: { brand: "Honda", model: "CB300R" }
// router.post("/model", addModel);

// // ─────────────────────────────────────────────────────────────────
// //  GET /api/v1/vehicle-meta/brands->   Returns all brands list
// router.get("/brands", getMetaBrands);

// // ─────────────────────────────────────────────────────────────────
// //  GET /api/v1/vehicle/models?brand=Honda
// router.get("/models", getMetaModelsByBrand);

// module.exports = router;

const router = require("express").Router();
const protect = require("../middlewares/auth");

// Vehicle CRUD (add/get real vehicles linked to customers)
const {
  addVehicle,
  getVehiclesByUser,
  getVehicleById,
  updateVehicle,
} = require("../controllers/vehicle.controller");

// Vehicle meta (brands/models master list for dropdowns)
const {
  addBrand,
  addModel,
  getMetaBrands,
  getMetaModelsByBrand,
} = require("../controllers/vehicleMeta.controller");

// ── All routes require authentication — must be FIRST ─────────────
router.use(protect);

// ─────────────────────────────────────────────────────────────────
//  Vehicle CRUD routes
// ─────────────────────────────────────────────────────────────────

// POST /api/v1/vehicle/add  — add vehicle to existing customer
router.post("/add", addVehicle);

// GET /api/v1/vehicle/customer/:customerId — all vehicles of a customer + user info
router.get("/customer/:customerId", getVehiclesByUser);

// PUT /api/v1/vehicle/:vehicleId — update vehicle fields
router.put("/:vehicleId", updateVehicle);

// GET /api/v1/vehicle/:vehicleId — single vehicle with customer info populated
router.get("/:vehicleId", getVehicleById);

// ─────────────────────────────────────────────────────────────────
//  Vehicle Meta routes (brands / models master list)
// ─────────────────────────────────────────────────────────────────

// POST /api/v1/vehicle/brand  Body: { brand: "Honda", models: ["Activa", "Shine"] }
router.post("/brand", addBrand);

// POST /api/v1/vehicle/model  Body: { brand: "Honda", model: "CB300R" }
router.post("/model", addModel);

// GET /api/v1/vehicle/brands — all brands list
router.get("/brands", getMetaBrands);

// GET /api/v1/vehicle/models?brand=Honda
router.get("/models", getMetaModelsByBrand);

module.exports = router;
