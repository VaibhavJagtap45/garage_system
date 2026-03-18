// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const protect = async (req, res, next) => {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "Token expired. Please login again."
          : "Invalid token.";
      return res.status(401).json({ success: false, message });
    }

    // 3. Check user still exists
    const user = await User.findById(decoded.sub).select("-otp");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
      });
    }

    // 4. Check user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Mobile number not verified.",
      });
    }

    // 5. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = protect;
