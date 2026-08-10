import prisma from "../config/db.js";

// নতুন কাস্টমার তৈরি করার কন্ট্রোলার
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, shopId } = req.body;

    // প্রয়োজনীয় ফিল্ড চেক করা
    if (!name || !shopId) {
      return res.status(400).json({ error: 'নাম এবং শপ আইডি আবশ্যক!' });
    }

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        address,
        shopId: Number(shopId), // নিশ্চিত করা যে এটি ইন্টিজার
      },
    });

    res.status(201).json({
      message: 'কাস্টমার সফলভাবে সংরক্ষণ করা হয়েছে!',
      data: newCustomer,
    });
  } catch (error) {
    console.error('Customer Creation Error:', error);
    res.status(500).json({ error: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।' });
  }
};