const router = require("express").Router();
const protect = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { addUserSchema } = require("../validators/user.validator");
const { getProfile, addUser } = require("../controllers/user.controller");
//  GET  /api/user/profile
router.get("/get-profile", protect, getProfile);
// ─────────────────────────────────────────────────────────────────
//  POST /api/user/add-user
router.post("/add-user", protect, validate(addUserSchema), addUser);

module.exports = router;
