const jwt = require("jsonwebtoken");

exports.authMiddleware = (req, res, next) => {
  const authHeader  = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

    const token = authHeader?.split(" ")[1];
  if (!token) {
    console.log("❌ No token found");
    return res.status(401).json({ message: "No token provided" });
  }




  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "123456789");
    console.log("✅ Token verified:", decoded);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
