import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ==========================================
// ১. রেজিস্ট্রেশন (Sign Up) কন্ট্রোলার
// ==========================================
export const register = async (req, res) => {
  const { name, email, password, role, phone, shopName, shopId } = req.body;

  try {
    const userExist = await prisma.user.findUnique({ where: { email } });
    if (userExist) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // সঠিক এনাম ভ্যালু নিশ্চিত করা
    const validRoles = ['ADMIN', 'MANAGER', 'CASHIER'];
    let assignedRole = validRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'CASHIER';

    let targetShopId = null;

    if (assignedRole === 'ADMIN') {
      if (!shopName) return res.status(400).json({ message: 'Shop name required for Admin' });
      const newShop = await prisma.shop.create({ data: { name: shopName } });
      targetShopId = newShop.id;
    } else {
      if (!shopId) return res.status(400).json({ message: 'Shop ID required' });
      targetShopId = parseInt(shopId);
    }

    const newUser = await prisma.user.create({
      data: { name, email, phone, password: hashedPassword, role: assignedRole, shopId: targetShopId }
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error(error); // টার্মিনালে আসল এররটি দেখতে পাবেন
    res.status(500).json({ message: 'Database Error', details: error.message });
  }
};

// ==========================================
// ২. লগইন (Login) কন্ট্রোলার
// ==========================================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // User খুঁজে বের করা
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // User না থাকলে
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Password মিলানো
    const isPasswordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatched) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // JWT Token তৈরি
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        shopId: user.shopId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Response পাঠানো
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopId: user.shopId,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};