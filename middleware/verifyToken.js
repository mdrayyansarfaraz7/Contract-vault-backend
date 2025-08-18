// middlewares/verifyToken.js
import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  try {
    console.log("---- VERIFY TOKEN MIDDLEWARE ----");
    console.log("Incoming cookies:", req.cookies);

    const token = req.cookies?.token;
    console.log("Extracted token:", token);

    if (!token) {
      console.log("No token found in cookies");
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token payload:", decoded);

    req.user = decoded;

    console.log("User attached to req:", req.user);
    console.log("---- END VERIFY TOKEN ----");
    next();
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

export default verifyToken;
