import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Inventory() {
  const API_URL = "http://localhost:5000/api/products";
  const CATEGORY_API_URL = "http://localhost:5000/api/categories";

  // --- States ---
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  // Popup & Form Control State
  const [addProductPopup, setAddProductPopup] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    purchasePrice: "",
    sellingPrice: "",
    quantity: "",
    unit: "Pcs",
    description: "",
  });

  // সাজেশন স্টেট সমূহ
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  // 🔒 টোকেন তুলে আনার হেল্পার ফাংশন
  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    console.log("Token:", token);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // --- ১. এপিআই থেকে প্রোডাক্ট ও ক্যাটাগরি ডেটা লোড করা ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [productsRes, categoriesRes] = await Promise.all([
          axios.get(API_URL, { headers: getAuthHeader() }),
          axios.get(CATEGORY_API_URL, { headers: getAuthHeader() }).catch(() => ({ data: [] }))
        ]);

        if (Array.isArray(productsRes.data)) {
          setProducts(productsRes.data);
        } else {
          setProducts([]);
        }

        if (Array.isArray(categoriesRes.data)) {
          setCategories(categoriesRes.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL]);

  // --- ২. সিঙ্গেল জেনেরিক ইনপুট হ্যান্ডলার (সাজেশন লজিক সহ) ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "name") {
      if (value.trim() === "") {
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        const matched = products
          .filter((p) => p.name && p.name.toLowerCase().includes(value.toLowerCase()))
          .map((p) => p.name);
        const uniqueSuggestions = [...new Set(matched)];
        setSuggestions(uniqueSuggestions);
        setShowSuggestions(uniqueSuggestions.length > 0);
      }
    }

    if (name === "category") {
      if (value.trim() === "") {
        setCategorySuggestions([]);
        setShowCategorySuggestions(false);
      } else {
        const matched = categories.filter((cat) =>
          cat.name.toLowerCase().includes(value.toLowerCase())
        );
        const uniqueSuggestions = [...new Map(matched.map(item => [item.name.toLowerCase(), item])).values()];
        setCategorySuggestions(uniqueSuggestions);
        setShowCategorySuggestions(uniqueSuggestions.length > 0);
      }
    }
  };

  // --- ৩. নতুন প্রোডাক্ট অ্যাড করা (shopId সেফ ইনজেকশন সহ) ---
  // --- ৩. নতুন প্রোডাক্ট অ্যাড করা (SKU ডুপ্লিকেট অ্যালার্ট হ্যান্ডলিং সহ) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    let currentShopId = null;
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        currentShopId = parsedUser.shopId || parsedUser.shop_id || null;
      }
    } catch (err) {
      console.error("Error parsing user from localStorage", err);
    }

    const productData = {
      name: formData.name,
      sku: formData.sku, // ইউজার যা ইনপুট দেবে সেটাই যাবে, ফাঁকা থাকলে ব্যাকএন্ড হ্যান্ডেল করবে
      category: formData.category || "General",
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      description: formData.description,
      shopId: currentShopId ? Number(currentShopId) : null,
      requestShopId: currentShopId ? Number(currentShopId) : null,
    };

    try {
      const response = await axios.post(API_URL, productData, { headers: getAuthHeader() });

      if (response.status === 201 || response.status === 200) {
        const savedProduct = response.data;
        setProducts((prev) => [savedProduct, ...prev]);

        const catName = savedProduct.category?.name || savedProduct.category || "General";
        if (!categories.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
          setCategories((prev) => [...prev, { id: savedProduct.categoryId || Date.now(), name: catName }]);
        }

        // ফর্ম রিসেট
        setFormData({
          name: "",
          sku: "",
          category: "",
          purchasePrice: "",
          sellingPrice: "",
          quantity: "",
          unit: "Pcs",
          description: "",
        });
        setSuggestions([]);
        setShowSuggestions(false);
        setCategorySuggestions([]);
        setShowCategorySuggestions(false);
        setAddProductPopup(false);
        alert("Product added successfully!");
      }
    } catch (error) {
      console.error("Error saving product:", error);

      // 🚨 SKU ডুপ্লিকেট এরর চেক এবং কাস্টম অ্যালার্ট সিস্টেম
      const errorMessage = error.response?.data?.error || "";

      if (errorMessage.includes("Unique constraint failed on the fields: (`sku`)") || errorMessage.includes("sku")) {
        alert("❌ This SKU Already Used Plese Change ");
      } else {
        // অন্য কোনো সাধারণ এরর হলে সেটার মেসেজ দেখাবে
        alert(error.response?.data?.message || "Something went wrong! Please try again.");
      }
    }
  };

  // --- ৪. প্রোডাক্ট ডিলিট করা ---
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await axios.delete(`${API_URL}/${id}`, { headers: getAuthHeader() });
      if (response.status === 200) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        alert("Product deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert(error.response?.data?.message || "Could not delete the product.");
    }
  };

  // --- ৫. ফ্রন্টএন্ড সার্চ ও ফিল্টারিং লজিক ---
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase());

    const categoryName = product.category?.name || (typeof product.category === 'string' ? product.category : "Uncategorized");
    const matchesCategory =
      selectedCategory === "All" || categoryName.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const getStatusStyle = (status) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "INACTIVE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* ১. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your shop products, stock levels, and pricing.</p>
        </div>
        <button
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm shadow-sm transition-all cursor-pointer"
          onClick={() => setAddProductPopup(true)}
        >
          <span>+ Add Product</span>
        </button>
      </div>

      {/* ২. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Products", value: products.length, icon: "📦", color: "text-indigo-600" },
          { title: "Total Stock Volume", value: products.reduce((acc, p) => acc + (parseFloat(p.quantity) || 0), 0), icon: "📊", color: "text-emerald-600" },
          { title: "Low Stock Items (<= 5)", value: products.filter((p) => (parseFloat(p.quantity) || 0) <= 5 && (parseFloat(p.quantity) || 0) > 0).length, icon: "⚠️", color: "text-amber-600" },
          { title: "Out of Stock", value: products.filter((p) => (parseFloat(p.quantity) || 0) === 0).length, icon: "🚫", color: "text-rose-600" },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
            </div>
            <div className={`text-2xl p-2 bg-slate-50 rounded-lg ${stat.color}`}>{stat.icon}</div>
          </div>
        ))}
      </div>

      {/* ৩. FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="w-full sm:flex-1 relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-slate-900 transition-all cursor-pointer"
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ৪. DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Product Info</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Purchase Price</th>
                <th className="px-6 py-3.5">Selling Price</th>
                <th className="px-6 py-3.5">Stock Quantity</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-400">Loading products...</td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{product.sku}</td>
                    <td className="px-6 py-4 text-slate-500">{product.category?.name || (typeof product.category === 'string' ? product.category : "Uncategorized")}</td>
                    <td className="px-6 py-4 text-slate-500">৳{Number(product.purchasePrice).toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">৳{Number(product.sellingPrice).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${product.quantity <= 5 ? "text-amber-600" : "text-slate-700"}`}>
                        {product.quantity} {product.unit || "Pcs"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium border rounded-md ${getStatusStyle(product.status)}`}>
                        {product.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        className="text-xs font-medium text-rose-600 hover:text-rose-900 hover:underline cursor-pointer"
                        onClick={() => handleDelete(product.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-slate-400">No products found matching the criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ৫. ADD PRODUCT POPUP */}
      {addProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setAddProductPopup(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all max-h-[calc(100vh-2rem)] flex flex-col z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Product</h2>
                <p className="text-xs text-slate-500">Fill in the item specifics to update the stock.</p>
              </div>
              <button onClick={() => setAddProductPopup(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="off"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => formData.name.trim() !== "" && suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="e.g. Miniket Rice"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                    {suggestions.map((name, index) => (
                      <li
                        key={index}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, name }));
                          setShowSuggestions(false);
                        }}
                        className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">SKU / Barcode</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="e.g. RC-MNKT-50"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category *</label>
                  <input
                    type="text"
                    name="category"
                    required
                    autoComplete="off"
                    value={formData.category}
                    onChange={handleChange}
                    onFocus={() => formData.category.trim() !== "" && categorySuggestions.length > 0 && setShowCategorySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                    placeholder="Type or select category..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                  {showCategorySuggestions && categorySuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                      {categorySuggestions.map((cat) => (
                        <li
                          key={cat.id}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, category: cat.name }));
                            setShowCategorySuggestions(false);
                          }}
                          className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          {cat.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Purchase Price (৳) *</label>
                  <input
                    type="number"
                    name="purchasePrice"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Selling Price (৳) *</label>
                  <input
                    type="number"
                    name="sellingPrice"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Stock Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    step="any"
                    required
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Unit *</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-slate-900 transition-all cursor-pointer"
                  >
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="KG">Kilogram (KG)</option>
                    <option value="GM">Gram (GM)</option>
                    <option value="Liter">Liter</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  name="description"
                  rows="2"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional product description..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setAddProductPopup(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}