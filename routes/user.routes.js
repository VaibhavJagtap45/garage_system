const router = require("express").Router();
const protect = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { addUserSchema } = require("../validators/user.validator");
const { getProfile, addUser, savePushToken } = require("../controllers/user.controller");

// ─────────────────────────────────────────────────────────────────
//  GET  /api/user/profile
router.get("/get-profile", protect, getProfile);
// ─────────────────────────────────────────────────────────────────
//  POST /api/user/add-user
router.post("/add-user", protect, validate(addUserSchema), addUser);

// ─────────────────────────────────────────────────────────────────
//  POST /api/v1/user/push-token
//  Save or update the authenticated user's Expo push token
router.post("/push-token", protect, savePushToken);

module.exports = router;
