import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiPackage,
  FiBarChart2,
  FiAlertTriangle,
  FiSlash,
  FiEdit2,
  FiTrash2,
  FiLoader,
} from "react-icons/fi";

const InventoryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  // পপআপের জন্য স্টেট
  const [selectedProductPacks, setSelectedProductPacks] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");

  // --- Fetch Products from Database ---
  useEffect(() => {
    const fetchProducts = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setProducts(Array.isArray(data) ? data : data.products || []);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [API_URL, token]);

  // --- Delete Product Handler ---
  const handleDelete = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত এই পণ্যটি মুছে ফেলতে চান?")) return;
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setProducts(products.filter((p) => p.id !== id));
      } else {
        alert("পণ্য ডিলিট করতে সমস্যা হয়েছে।");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // --- Total Stock Calculation Helper ---
  const calculateTotalStock = (product) => {
    return Number(product.quantity) || 0;
  };

  // --- Calculations for Top Cards ---
  const totalProductsCount = products.length;
  const outOfStockCount = products.filter(
    (p) => calculateTotalStock(p) === 0,
  ).length;
  const lowStockCount = products.filter((p) => {
    const total = calculateTotalStock(p);
    return total > 0 && total <= (p.lowStockLimit || 5);
  }).length;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your shop products, stock levels, and pricing.
            </p>
          </div>

          {/* Add Product Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/bulk_import")}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FiPlus size={18} /> Import/Export
            </button>
            <button
              onClick={() => navigate("/product_entry")}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-slate-900/10 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FiPlus size={18} /> Add Product
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Products
              </p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                {totalProductsCount}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <FiPackage size={22} />
            </div>
          </div>

          {/* Card 2: Total Stock Volume */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Stock Volume
              </p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                {products.reduce(
                  (acc, curr) => acc + calculateTotalStock(curr),
                  0,
                )}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FiBarChart2 size={22} />
            </div>
          </div>

          {/* Card 3: Low Stock Products */}
          <div
            onClick={() => navigate("/stock_low")}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all duration-200"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Low Stock Products
              </p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                {lowStockCount}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
              <FiAlertTriangle size={22} />
            </div>
          </div>

          {/* Card 4: Out of Stock */}
          <div
            onClick={() => navigate("/out_of_stock")}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-lg hover:border-rose-300 transition-all duration-200"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Out of Stock
              </p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                {outOfStockCount}
              </h3>
            </div>
            <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
              <FiSlash size={22} />
            </div>
          </div>
        </div>

        {/* Filter & Search Section */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <FiSearch
              className="absolute left-4 top-3.5 text-slate-400"
              size={18}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-800"
            />
          </div>

          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none font-medium text-slate-700"
            >
              <option value="All Categories">All Categories</option>
              <option value="Rice">Rice</option>
              <option value="Grocery">Grocery</option>
            </select>
          </div>
        </div>

        {/* Product Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4">Product Info</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Purchase Price</th>
                  <th className="p-4">Selling Price</th>
                  <th className="p-4">Stock Quantity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-10 text-slate-400 font-medium"
                    >
                      <div className="flex justify-center items-center gap-2">
                        <FiLoader className="animate-spin" size={20} /> ডেটা লোড
                        হচ্ছে...
                      </div>
                    </td>
                  </tr>
                ) : products.length > 0 ? (
                  products
                    .filter(
                      (p) =>
                        p.name
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        (p.sku &&
                          p.sku
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())),
                    )
                    .map((product) => {
                      const totalStock = calculateTotalStock(product);
                      const isPack =
                        product.inventoryType === "pack" &&
                        product.packs &&
                        product.packs.length > 0;

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50/50 transition"
                        >
                          <td className="p-4 font-bold text-slate-800">
                            {product.name}
                          </td>
                          <td className="p-4 text-slate-500 font-mono text-xs">
                            {product.sku}
                          </td>
                          <td className="p-4 text-slate-600">
                            {product.category?.name ||
                              product.category ||
                              "N/A"}
                          </td>
                          <td className="p-4 text-slate-600">
                            ৳{product.purchasePrice?.toFixed(2) || "0.00"}
                          </td>
                          <td className="p-4 text-slate-600">
                            ৳{product.sellingPrice?.toFixed(2) || "0.00"}
                          </td>

                          {/* Stock Quantity Column with Popup Trigger for Pack Products */}
                          <td className="p-4 flex items-center justify-center">
                            {isPack ? (
                              <button
                                onClick={() => setSelectedProductPacks(product)}
                                className="font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
                                title="প্যাকের বিস্তারিত দেখতে ক্লিক করুন"
                              >
                                <span>
                                  {totalStock} {product.baseUnit || "Pcs"}
                                </span>
                                <span className="text-[10px] bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-md">
                                  ডিটেইলস
                                </span>
                              </button>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {totalStock} {product.baseUnit || "Pcs"}
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg ${product.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                                  : "bg-rose-50 text-rose-600 border border-rose-200/50"
                                }`}
                            >
                              {product.status || "ACTIVE"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() =>
                                  navigate(`/product_edit/${product.id}`)
                                }
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <FiEdit2 size={14} /> Edit
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <FiTrash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="text-center py-10 text-slate-400 font-medium"
                    >
                      কোনো পণ্য পাওয়া যায়নি! ওপরের "+ Add Product" বাটন থেকে
                      পণ্য যোগ করুন।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <p>
              Showing 1 to {products.length} of {products.length} results
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 font-semibold cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Page 1 of 1
              </span>
              <button
                disabled
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 font-semibold cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Pack Details Modal (Popup) --- */}
      {selectedProductPacks && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  {selectedProductPacks.name}
                </h3>
                <p className="text-xs text-slate-500">
                  প্যাক অনুযায়ী স্টক বিবরণী
                </p>
              </div>
              <button
                onClick={() => setSelectedProductPacks(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Packs List inside Popup */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {selectedProductPacks.packs.map((pack, idx) => {
                const totalBaseUnits =
                  (Number(pack.stock) || 0) * (Number(pack.multiplier) || 1);
                return (
                  <div
                    key={idx}
                    className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {pack.packName || "Default Pack"}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        স্টক: {pack.stock} প্যাক (প্রতিটিতে {pack.multiplier}{" "}
                        {selectedProductPacks.baseUnit || "Pcs"})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-violet-600 text-sm">
                        {totalBaseUnits}{" "}
                        {selectedProductPacks.baseUnit || "Pcs"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedProductPacks(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
