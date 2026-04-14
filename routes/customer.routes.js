// routes/customer.routes.js
const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const {
  getGarageInfo,
  getServices,
  getMyVehicles,
  addMyVehicle,
  getMyOrders,
  getOrderDetail,
  createOrder,
  cancelMyOrder,
  getMyInvoices,
  getInvoiceDetail,
  getMyProfile,
  updateMyProfile,
} = require("../controllers/customer.controller");
const {
  getMyBookings,
  createMyBooking,
  cancelMyBooking,
} = require("../controllers/booking.controller");

// All customer portal routes require auth + customer role
router.use(protect, requireRole("customer"));

router.get("/garage-info", getGarageInfo);

router.get("/services", getServices);

router.get("/vehicles", getMyVehicles);
router.post("/vehicles", addMyVehicle);

router.get("/orders", getMyOrders);
router.get("/orders/:id", getOrderDetail);
router.post("/orders", createOrder);
router.patch("/orders/:id/cancel", cancelMyOrder);

router.get("/invoices", getMyInvoices);
router.get("/invoices/:id", getInvoiceDetail);

router.get("/profile", getMyProfile);
router.put("/profile", updateMyProfile);

router.get("/bookings", getMyBookings);
router.post("/bookings", createMyBooking);
router.patch("/bookings/:id/cancel", cancelMyBooking);

module.exports = router;
