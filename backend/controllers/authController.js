import prisma from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ১. রেজিস্ট্রেশন (Sign Up) কন্ট্রোলার
export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExist = await prisma.user.findUnique({
      where: { email }
    });

    if (userExist) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role ? role.toUpperCase() : 'CASHIER'
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// ২. লগইন (Login) কন্ট্রোলার
export const login = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // ১. ইমেইল দিয়ে ইউজার চেক
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ২. রোল ভেরিফিকেশন (সব ক্যাপিটাল লেটার করে ম্যাচ করা হচ্ছে)
    // নিশ্চিত করো ফ্রন্টএন্ডের রোল আর ডেটাবেজের রোল মিলছে (যেমন: STAFF vs CASHIER)
    const requestedRole = role ? role.toUpperCase() : 'CASHIER';
    if (user.role.toUpperCase() !== requestedRole) {
      return res.status(403).json({ message: `Access denied. You are not registered as a ${role}` });
    }

    // ৩. পাসওয়ার্ড ম্যাচিং
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // ⚠️ নিশ্চিত করো তোমার .env ফাইলে JWT_SECRET দেওয়া আছে, না থাকলে fallback 'supersecret' কাজ করবে
    const secretKey = process.env.JWT_SECRET || 'supersecretkey123';

    // ৪. JWT টোকেন জেনারেট
    const token = jwt.sign(
      { id: user.id, role: user.role },
      secretKey,
      { expiresIn: '1d' }
    );

    // পাসওয়ার্ড বাদে বাকি ডেটা পাঠানো
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