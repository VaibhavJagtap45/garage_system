// middlewares/requireRole.js
// Usage: router.use(protect, requireRole("customer"))
//        router.use(protect, requireRole("member", "owner"))

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };

module.exports = requireRole;
