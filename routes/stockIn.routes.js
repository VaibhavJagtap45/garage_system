const router = require("express").Router();
const protect = require("../middlewares/auth");
const { listStockIn, createStockIn, deleteStockIn, getStockInStats } = require("../controllers/stockIn.controller");

router.use(protect);

// GET  /api/v1/stock-in/stats?dateFrom=&dateTo=
router.get("/stats", getStockInStats);

// GET  /api/v1/stock-in
router.get("/", listStockIn);

// POST /api/v1/stock-in
router.post("/", createStockIn);

// DELETE /api/v1/stock-in/:id
router.delete("/:id", deleteStockIn);

module.exports = router;
