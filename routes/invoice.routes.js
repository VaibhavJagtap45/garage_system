const router = require("express").Router();
const protect = require("../middlewares/auth");
const {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
} = require("../controllers/invoice.controller");

router.use(protect);

// GET  /api/v1/invoices/stats?dateFrom=&dateTo=
router.get("/stats", getInvoiceStats);

// GET  /api/v1/invoices?status=&customerId=&page=&limit=
router.get("/", listInvoices);

// GET  /api/v1/invoices/:id
router.get("/:id", getInvoice);

// POST /api/v1/invoices
router.post("/", createInvoice);

// PUT  /api/v1/invoices/:id
router.put("/:id", updateInvoice);

// DELETE /api/v1/invoices/:id
router.delete("/:id", deleteInvoice);

module.exports = router;
