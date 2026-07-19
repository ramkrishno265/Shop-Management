import jwt from "jsonwebtoken";

export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization || req.headers["authorization"];
  console.log(req.headers.authorization);


  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      token = authHeader.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "supersecretkey123"
      );

      req.user = {
        id: decoded.id,
        role: decoded.role,
        shopId: decoded.shopId,
      };

      return next();
    } catch (error) {
      console.error("Token verification error:", error);

      return res.status(401).json({
        message: "টোকেনটি সঠিক নয় বা এক্সপায়ারড!",
      });
    }
  }

  return res.status(401).json({
    message: "কোনো অথরাইজেশন টোকেন পাওয়া যায়নি!",
  });
};