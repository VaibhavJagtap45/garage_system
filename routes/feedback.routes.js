const router = require("express").Router();
const protect = require("../middlewares/auth");
const {
  listFeedbacks,
  getFeedbackStats,
  createFeedback,
  deleteFeedback,
} = require("../controllers/feedback.controller");

router.use(protect);

// GET  /api/v1/feedbacks/stats
router.get("/stats", getFeedbackStats);

// GET  /api/v1/feedbacks
router.get("/", listFeedbacks);

// POST /api/v1/feedbacks
router.post("/", createFeedback);

// DELETE /api/v1/feedbacks/:id
router.delete("/:id", deleteFeedback);

module.exports = router;
