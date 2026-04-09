// routes/member.routes.js
const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const {
  getDashboard,
  getOrders,
  getOrderDetail,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  updateOrderParts,
  getInventory,
  getMyProfile,
  updateMyProfile,
} = require("../controllers/member.controller");

// All member portal routes require auth + member role
router.use(protect, requireRole("member"));

router.get("/dashboard", getDashboard);
router.get("/orders", getOrders);
router.get("/orders/:id", getOrderDetail);
router.put("/orders/:id/accept", acceptOrder);
router.put("/orders/:id/reject", rejectOrder);
router.put("/orders/:id/status", updateOrderStatus);
router.put("/orders/:id/parts", updateOrderParts);

router.get("/inventory", getInventory);

router.get("/profile", getMyProfile);
router.put("/profile", updateMyProfile);

module.exports = router;
