const router = require("express").Router();
const protect = require("../middlewares/auth");
const { listTags, createTag, updateTag, deleteTag } = require("../controllers/tag.controller");

router.use(protect);

router.get("/", listTags);
router.post("/", createTag);
router.put("/:id", updateTag);
router.delete("/:id", deleteTag);

module.exports = router;
