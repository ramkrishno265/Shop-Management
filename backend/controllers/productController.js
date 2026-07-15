// রিয়েল-লাইফ ডেটাবেজ কানেক্ট না হওয়া পর্যন্ত আমরা একটি খালি অ্যারে দিয়ে শুরু করছি
let products = [];

// ১. সব প্রোডাক্ট গেট করা
export const getProducts = async (req, res) => {
  try {
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching products", error: error.message });
  }
};

// ২. নতুন প্রোডাক্ট তৈরি করা
export const createProduct = async (req, res) => {
  try {
    const { name, sku, category, price, stock, status } = req.body;

    // ভ্যালিডেশন
    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const stockQty = parseInt(stock) || 0;
    
    // স্টকের উপর ভিত্তি করে স্ট্যাটাস অটো-ক্যালকুলেট করা
    let finalStatus = status;
    if (!finalStatus) {
      if (stockQty === 0) finalStatus = "Out of Stock";
      else if (stockQty <= 15) finalStatus = "Low Stock";
      else finalStatus = "In Stock";
    }

    const newProduct = {
      id: Date.now(), // ইউনিক আইডি জেনারেশন
      name,
      sku: sku || `SKU-${Math.floor(Math.random() * 100000)}`,
      category,
      price: parseFloat(price) || 0,
      stock: stockQty,
      status: finalStatus
    };

    // ডেটা এরে-র শুরুতে পুশ করা
    products.unshift(newProduct);

    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: "Server error while saving product", error: error.message });
  }
};

// ৩. প্রোডাক্ট ডিলিট করা
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const initialLength = products.length;

    // আইডি দিয়ে ফিল্টার করা (যেহেতু রিকোয়েস্ট থেকে আসা id একটি string, তাই parseInt করা হয়েছে)
    products = products.filter((product) => product.id !== parseInt(id));

    if (products.length === initialLength) {
      return res.status(404).json({ message: "Product not found!" });
    }

    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error while deleting product", error: error.message });
  }
};