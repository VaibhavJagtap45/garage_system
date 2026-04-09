const router = require("express").Router();
const protect = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const {
  listBookings,
  createBooking,
  getBookingDetail,
  updateBookingStatus,
  convertToRepairOrder,
  linkRepairOrder,
  syncBookingCalendar,
} = require("../controllers/booking.controller");

router.use(protect, requireRole("owner"));

router.get("/", listBookings);
router.post("/", createBooking);
router.get("/:id", getBookingDetail);
router.patch("/:id/status", updateBookingStatus);
router.post("/:id/convert", convertToRepairOrder);
router.patch("/:id/link-ro", linkRepairOrder);
router.post("/:id/calendar-sync", syncBookingCalendar);

module.exports = router;
