const router = require("express").Router();
const protect = require("../middlewares/auth");
const { listExpenses, getExpenseStats, createExpense, deleteExpense } = require("../controllers/expense.controller");

router.use(protect);

// GET /api/v1/expenses/stats?dateFrom=&dateTo=
router.get("/stats", getExpenseStats);

// GET /api/v1/expenses?dateFrom=&dateTo=&page=&limit=
router.get("/", listExpenses);

// POST /api/v1/expenses
router.post("/", createExpense);

// DELETE /api/v1/expenses/:id
router.delete("/:id", deleteExpense);

module.exports = router;
