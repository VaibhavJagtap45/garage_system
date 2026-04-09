const router = require("express").Router();
const adminProtect = require("../middlewares/adminAuth");
const {
  adminLogin,
  getAllGarages,
  getGarageStats,
  createGarage,
  updateGarage,
  deleteGarage,
  approveGarage,
  rejectGarage,
} = require("../controllers/admin.controller");

// ── Public ────────────────────────────────────────────────────────
router.post("/login", adminLogin);

// ── Protected ─────────────────────────────────────────────────────
router.get("/garages/stats",          adminProtect, getGarageStats);
router.get("/garages",                adminProtect, getAllGarages);
router.post("/garages",               adminProtect, createGarage);
router.put("/garages/:id",            adminProtect, updateGarage);
router.delete("/garages/:id",         adminProtect, deleteGarage);
router.patch("/garages/:id/approve",  adminProtect, approveGarage);
router.patch("/garages/:id/reject",   adminProtect, rejectGarage);

module.exports = router;
