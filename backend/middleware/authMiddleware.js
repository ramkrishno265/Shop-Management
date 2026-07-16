import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization || req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      token = authHeader.split(' ')[1];

      // টোকেন ডিকোড করা
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');

      // রিকোয়েস্টে সরাসরি ডাটা সেট করা
      req.user = {
        id: decoded.id,
        role: decoded.role,     // ADMIN, MANAGER, CASHIER
        shopId: decoded.shopId  // 🔗 এই লাইনটি আন-কমেন্ট করা হলো (এখন ডাটা পাস হবে)
      };

      return next(); 
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "টোকেনটি সঠিক নয় বা এক্সপায়ারড!" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "কোনো অথরাইজেশন টোকেন পাওয়া যায়নি!" });
  }
};