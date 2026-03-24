const router = require("express").Router();
const multer = require("multer");
const protect = require("../middlewares/auth");
const {
  listCatalogItems,
  createCatalogItem,
  bulkUploadCatalogItems,
} = require("../controllers/servicePartsCatalog.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(protect);

router.get("/", listCatalogItems);
router.post("/", createCatalogItem);
router.post("/bulk-upload", upload.single("file"), bulkUploadCatalogItems);

module.exports = router;
