import prisma from "../config/db.js";

// ১. নির্দিষ্ট শপের সব ক্যাটাগরি গেট করা
export const getCategories = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ message: "Shop ID is required" });
    }
    

    const categories = await prisma.category.findMany({
      where: { 
        shopId: Number(shopId) // shopId যদি ডেটাবেজে Int টাইপের হয়
      }
    });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error: error.message });
  }
};

// ২. নির্দিষ্ট শপের জন্য নতুন ক্যাটাগরি তৈরি করা
export const createCategory = async (req, res) => {
  try {
    const { name, shopId } = req.body; // body theke name ar shopId nite hobe

    if (!name || !shopId) {
      return res.status(400).json({ message: "Category name and Shop ID are required" });
    }

    const newCategory = await prisma.category.create({
      data: { 
        name, 
        shopId: Number(shopId) // Database-e shopId save kora holo
      }
    });
    
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: "Error creating category", error: error.message });
  }
};