import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Inventory() {
  const API_URL = "http://localhost:5000/api/products";

  // --- States ---
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  // Popup & Form Control State
  const [addProductPopup, setAddProductPopup] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Electronics",
    price: "",
    stock: "",
  });

  // Product Name-এর ড্রপডাউন সাজেশন ও ফোকাস কন্ট্রোল করার স্টেট
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);


  // --- ১. এপিআই থেকে প্রোডাক্ট ডেটা লোড করা ---
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await axios.get(API_URL);
        if (Array.isArray(response.data)) {
          setProducts(response.data);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL]);


  // --- ২. ইনপুট হ্যান্ডল করা এবং সাজেশন ফিল্টার করা ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // প্রোডাক্ট নাম টাইপ করার সময় সাজেশন চেক করা
    if (name === "name") {
      if (value.trim() === "") {
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        // আগের প্রোডাক্ট লিস্ট থেকে টাইপ করা অক্ষরের সাথে মিল আছে এমন ইউনিক নামগুলো ফিল্টার করা
        const matched = products
          .filter(
            (p) => p.name && p.name.toLowerCase().includes(value.toLowerCase())
          )
          .map((p) => p.name);

        // ডুপ্লিকেট নাম বাদ দিয়ে ইউনিক করা
        const uniqueSuggestions = [...new Set(matched)];

        setSuggestions(uniqueSuggestions);
        setShowSuggestions(uniqueSuggestions.length > 0);
      }
    }
  };


  // --- ৩. এপিআই কল করে প্রোডাক্ট অ্যাড করা ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    const stockQty = parseInt(formData.stock) || 0;
    let currentStatus = "In Stock";
    if (stockQty === 0) currentStatus = "Out of Stock";
    else if (stockQty <= 15) currentStatus = "Low Stock";

    const productData = {
      name: formData.name,
      sku: formData.sku || `SKU-${Math.floor(Math.random() * 100000)}`,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      stock: stockQty,
      status: currentStatus,
    };

    try {
      const response = await axios.post(API_URL, productData);

      if (response.status === 201 || response.status === 200) {
        const savedProduct = response.data;
        // রিলোড ছাড়াই নতুন প্রোডাক্টটি তালিকার শুরুতে যোগ করা
        setProducts((prevProducts) => [savedProduct, ...prevProducts]);

        // ফর্ম রিসেট ও পপআপ বন্ধ করা
        setFormData({
          name: "",
          sku: "",
          category: "Electronics",
          price: "",
          stock: "",
        });
        setSuggestions([]);
        setShowSuggestions(false);
        setAddProductPopup(false);
        alert("Product added successfully!");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert(
        error.response?.data?.message ||
          "Something went wrong! Please try again."
      );
    }
  };


  // --- ৪. প্রোডাক্ট ডিলিট করা ---
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;

    try {
      const response = await axios.delete(`${API_URL}/${id}`);

      if (response.status === 200) {
        setProducts((prevProducts) =>
          prevProducts.filter(
            (product) => product.id !== id && product._id !== id
          )
        );
        alert("Product deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert(error.response?.data?.message || "Could not delete the product.");
    }
  };


  // ফিল্টারিং লজিক
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });


  // স্টকের কালার নির্ধারণ
  const getStatusStyle = (status) => {
    switch (status) {
      case "In Stock":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Low Stock":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Out of Stock":
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your shop products, stock levels, and pricing.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm shadow-xs transition-all cursor-pointer"
          onClick={() => setAddProductPopup(true)}
        >
          <span>+ Add Product</span>
        </button>
      </div>

      {/* ২. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Total Products",
            value: products.length,
            icon: "📦",
            color: "text-indigo-600",
          },
          {
            title: "Total Stock Volume",
            value: products.reduce(
              (acc, p) => acc + (parseInt(p.stock) || 0),
              0
            ),
            icon: "📊",
            color: "text-emerald-600",
          },
          {
            title: "Low Stock Items",
            value: products.filter((p) => p.status === "Low Stock").length,
            icon: "⚠️",
            color: "text-amber-600",
          },
          {
            title: "Out of Stock",
            value: products.filter((p) => p.status === "Out of Stock").length,
            icon: "🚫",
            color: "text-rose-600",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {stat.title}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stat.value}
              </h3>
            </div>
            <div
              className={`text-2xl p-2 bg-slate-50 rounded-lg ${stat.color}`}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ৩. FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        <div className="w-full sm:flex-1 relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:bg-white focus:border-slate-900 transition-all cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Accessories">Accessories</option>
            <option value="Footwear">Footwear</option>
          </select>
        </div>
      </div>

      {/* ৪. DATA TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Product Info</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Price</th>
                <th className="px-6 py-3.5">Stock Quantity</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr
                    key={product._id || product.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ${Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-semibold ${
                          product.stock <= 15
                            ? "text-amber-600"
                            : "text-slate-700"
                        }`}
                      >
                        {product.stock} units
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium border rounded-md ${getStatusStyle(
                          product.status
                        )}`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        className="text-xs font-medium text-rose-600 hover:text-rose-900 hover:underline cursor-pointer"
                        onClick={() => handleDelete(product._id || product.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    No products found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ৫. ADD PRODUCT POPUP */}
      {addProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setAddProductPopup(false)}
          ></div>
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all max-h-[calc(100vh-2rem)] flex flex-col z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Add New Product
                </h2>
                <p className="text-xs text-slate-500">
                  Fill in the item specifics to update the stock.
                </p>
              </div>
              <button
                onClick={() => setAddProductPopup(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Product Name (সাজেশন ড্রপডাউন সহ) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="off"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => {
                    if (formData.name.trim() !== "" && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="e.g. Wireless Mouse"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                />

                {/* সাজেশন ড্রপডাউন মেনু */}
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    SKU / Barcode
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="e.g. MS-WRLS-01"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:bg-white focus:border-slate-900 transition-all cursor-pointer"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Footwear">Footwear</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    required
                    value={formData.stock}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
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
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
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