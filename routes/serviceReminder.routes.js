const router = require("express").Router();
const protect = require("../middlewares/auth");
const {
  listServiceReminders,
  createServiceReminder,
  markServiceReminderDone,
  deleteServiceReminder,
} = require("../controllers/serviceReminder.controller");

router.use(protect);

// GET  /api/v1/service-reminders?tab=due|overdue|done
router.get("/", listServiceReminders);

// POST /api/v1/service-reminders
router.post("/", createServiceReminder);

// PUT  /api/v1/service-reminders/:id/done
router.put("/:id/done", markServiceReminderDone);

// DELETE /api/v1/service-reminders/:id
router.delete("/:id", deleteServiceReminder);

module.exports = router;
