const jwt = require("jsonwebtoken");

const adminProtect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (decoded.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Admin access only." });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" ? "Token expired." : "Invalid token.";
    return res.status(401).json({ success: false, message });
  }
};

module.exports = adminProtect;
