import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ==========================================
// ১. রেজিস্ট্রেশন (Sign Up) কন্ট্রোলার
// ==========================================
export const register = async (req, res) => {
  // ফ্রন্টএন্ড থেকে shopName (ADMIN এর জন্য) অথবা shopId (MANAGER/STAFF এর জন্য) আসবে
  const { name, email, password, role, shopName, shopId } = req.body;

  try {
    const userExist = await prisma.user.findUnique({
      where: { email }
    });

    if (userExist) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // রোলের ফরম্যাট ঠিক করা (যেমন: ADMIN, MANAGER, CASHIER/STAFF)
    // ফ্রন্টএন্ডে 'staff' পাঠালে সেটাকে ডাটাবেজের এনাম 'CASHIER' এ রূপান্তর করতে পারো
    let assignedRole = role ? role.toUpperCase() : 'CASHIER';
    if (assignedRole === 'STAFF') assignedRole = 'CASHIER';

    let targetShopId = null;

    // ✨ ম্যাজিক লজিক: ADMIN হলে নতুন শপ অটো তৈরি হবে
    if (assignedRole === 'ADMIN') {
      if (!shopName) {
        return res.status(400).json({ message: 'Shop name is required for Admin registration!' });
      }

      // ১. ডাটাবেজে নতুন শপ ক্রিয়েট করা (আইডি অটো তৈরি হবে)
      const newShop = await prisma.shop.create({
        data: {
          name: shopName.trim()
        }
      });

      // ২. অটো-জেনারেটেড আইডিটি ইউজারকে অ্যাসাইন করার জন্য সেট করা
      targetShopId = newShop.id;
    } else {
      // MANAGER বা CASHIER হলে ফ্রন্টএন্ডের পাঠানো shopId ব্যবহার করবে
      if (!shopId) {
        return res.status(400).json({ message: 'Shop ID is required for staff/manager!' });
      }
      targetShopId = parseInt(shopId);
    }

    // ৩. নতুন ইউজার তৈরি (শপ আইডি সহ)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: assignedRole,
        shopId: targetShopId // এখানে সবার জন্যই অটোমেটিক সঠিক শপ আইডি বসে যাচ্ছে!
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

// ==========================================
// ২. লগইন (Login) কন্ট্রোলার
// ==========================================
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const secretKey = process.env.JWT_SECRET || 'supersecretkey123';

    // টোকেনের পে-লোডে ইউজারের আইডি, রোল এবং শপ আইডি ঢুকিয়ে দেওয়া হচ্ছে
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        shopId: user.shopId 
      },
      secretKey,
      { expiresIn: '1d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};