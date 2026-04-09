const router = require("express").Router();
const protect = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const {
  disconnect,
  getConnectUrl,
  getStatus,
  oauthCallback,
} = require("../controllers/googleCalendar.controller");

router.get("/oauth/callback", oauthCallback);

router.use(protect, requireRole("owner"));

router.get("/status", getStatus);
router.get("/connect-url", getConnectUrl);
router.delete("/disconnect", disconnect);

module.exports = router;
