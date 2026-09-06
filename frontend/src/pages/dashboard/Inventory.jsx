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
  FiDollarSign,
} from "react-icons/fi";

const ITEMS_PER_PAGE = 15;

const InventoryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [currentPage, setCurrentPage] = useState(1);

  // পপআপের জন্য স্টেট
  const [selectedProductPacks, setSelectedProductPacks] = useState(null);

  // --- Bulk Delete স্টেট ---
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");

  // --- Fetch Products from Database (FIFO Layer & Quantity Fix সহ) ---
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
          const productList = Array.isArray(data)
            ? data
            : data.products || data.data || [];

          // ১. FIFO লজিক অনুযায়ী purchasePrice এবং inventoryLayers থেকে মোট quantity বা অন্যান্য হিসাব সেট করা
          const formattedProducts = productList.map((product) => {
            const layers = product.inventoryLayers || [];

            // পুরোনো লেয়ার আগে সাজানো (FIFO Rule: ascending order)
            const sortedLayers = [...layers].sort((a, b) => a.id - b.id);

            // যে লেয়ারের remainingQty এখনো শূন্যের বেশি আছে (Active Layer)
            let activeLayer = sortedLayers.find(
              (layer) => layer.remainingQty > 0,
            );

            // যদি সবগুলোর remainingQty 0 হয়ে যায়, তবে শেষ লেয়ারটি ধরব
            if (!activeLayer && sortedLayers.length > 0) {
              activeLayer = sortedLayers[sortedLayers.length - 1];
            }

            // লেয়ারগুলো থেকে মোট রিমেইনিং স্টক হিসাব করা (যদি প্রডাক্টের নিজস্ব quantity না থাকে)
            const totalLayerQuantity = sortedLayers.reduce(
              (sum, layer) => sum + (Number(layer.remainingQty) || 0),
              0,
            );

            return {
              ...product,
              // FIFO লেয়ারের unitCost দিয়ে purchasePrice ওভাররাইট করা
              purchasePrice: activeLayer
                ? Number(activeLayer.unitCost)
                : Number(product.purchasePrice) || 0,
              // যদি প্রোডাক্ট টেবিলে quantity না থাকে, তবে লেয়ারের remainingQty গুলোর যোগফলকে quantity হিসেবে ধরবে
              quantity:
                product.quantity !== undefined && product.quantity !== null
                  ? Number(product.quantity)
                  : totalLayerQuantity,
              inventoryLayers: sortedLayers,
            };
          });

          setProducts(formattedProducts);
        } else {
          console.error("Failed to fetch products:", data.message);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL, token]);

  // --- Search/Category/Brand পরিবর্তন হলে page 1-এ ফিরে যাবে ---
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedBrand]);

  // --- Delete Product Handler (Single) ---
  const handleDelete = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত এই পণ্যটি মুছে ফেলতে চান?")) return;
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setProducts(products.filter((p) => p.id !== id));
        setSelectedIds((prev) => prev.filter((x) => x !== id));
      } else {
        alert("পণ্য ডিলিট করতে সমস্যা হয়েছে।");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // --- Select One / Select All Toggle ---
  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const currentPageIds = paginatedProducts.map((p) => p.id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id)),
      );
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...currentPageIds])),
      );
    }
  };

  // --- Bulk Delete Handler ---
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `আপনি কি নিশ্চিত ${selectedIds.length} টি পণ্য মুছে ফেলতে চান?`,
      )
    )
      return;

    setBulkDeleting(true);
    try {
      const response = await fetch(`${API_URL}/products/bulk-delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (response.ok) {
        setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
        setSelectedIds([]);
      } else {
        alert("কিছু পণ্য ডিলিট করতে সমস্যা হয়েছে।");
      }
    } catch (error) {
      console.error("Error bulk deleting products:", error);
      alert("সার্ভার এরর হয়েছে। একে একে ডিলিট করার চেষ্টা করা হচ্ছে...");

      try {
        await Promise.all(
          selectedIds.map((id) =>
            fetch(`${API_URL}/products/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }),
          ),
        );
        setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
        setSelectedIds([]);
      } catch (fallbackError) {
        console.error("Fallback bulk delete failed:", fallbackError);
      }
    } finally {
      setBulkDeleting(false);
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

  // --- স্টকে থাকা সব প্রোডাক্টের ক্রয়মূল্য (FIFO Unit Cost) অনুযায়ী মোট টাকার পরিমাণ ---
  const totalStockValue = products.reduce((acc, curr) => {
    const stockQty = calculateTotalStock(curr);
    const purchasePrice = Number(curr.purchasePrice) || 0;
    return acc + stockQty * purchasePrice;
  }, 0);

  // --- Products থেকে ইউনিক ক্যাটাগরি লিস্ট বের করা ---
  const categoryOptions = Array.from(
    new Set(
      products
        .map((p) => p.category?.name || p.category)
        .filter((c) => c && c.trim() !== ""),
    ),
  ).sort();

  // --- Products থেকে ইউনিক ব্র্যান্ড লিস্ট বের করা ---
  const brandOptions = Array.from(
    new Set(
      products
        .map((p) => p.brand?.name || p.brand)
        .filter((b) => b && b.trim() !== ""),
    ),
  ).sort();

  // --- Search + Category + Brand ফিল্টার করা লিস্ট ---
  const filteredProducts = products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const productCategory = (
      p.category?.name ||
      p.category ||
      ""
    ).toLowerCase();

    const productBrand = (p.brand?.name || p.brand || "").toLowerCase();

    const matchesSearch =
      term === "" ||
      p.name.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      productCategory.includes(term) ||
      productBrand.includes(term);

    const matchesCategory =
      selectedCategory === "All Categories" ||
      (p.category?.name || p.category) === selectedCategory;

    const matchesBrand =
      selectedBrand === "All Brands" ||
      (p.brand?.name || p.brand) === selectedBrand;

    return matchesSearch && matchesCategory && matchesBrand;
  });

  // --- Pagination Calculation ---
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE),
  );
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const isAllCurrentPageSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.includes(p.id));

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 font-sans">
      <div className="mx-auto space-y-6">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your shop products, stock levels, and pricing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-rose-600/10 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleting ? (
                  <FiLoader className="animate-spin" size={18} />
                ) : (
                  <FiTrash2 size={18} />
                )}
                {bulkDeleting
                  ? "Deleting..."
                  : `Delete Selected (${selectedIds.length})`}
              </button>
            )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Stock Value
              </p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                ৳
                {totalStockValue.toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FiDollarSign size={22} />
            </div>
          </div>

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

          <div
            onClick={() => navigate("/stock_low")}
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
              placeholder="Search by product name, SKU or brand..."
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
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-48">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none font-medium text-slate-700"
            >
              <option value="All Brands">All Brands</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 w-10 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer accent-slate-900 align-middle"
                    />
                  </th>
                  <th className="p-4 align-middle">Product Info</th>
                  <th className="p-4 align-middle">SKU</th>
                  <th className="p-4 align-middle">Category</th>
                  <th className="p-4 align-middle">Brand</th>
                  <th className="p-4 align-middle">Purchase Price (FIFO)</th>
                  <th className="p-4 align-middle">Selling Price</th>
                  <th className="p-4 align-middle">Stock Quantity</th>
                  <th className="p-4 align-middle">Status</th>
                  <th className="p-4 text-center align-middle">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="text-center py-10 text-slate-400 font-medium"
                    >
                      <div className="flex justify-center items-center gap-2">
                        <FiLoader className="animate-spin" size={20} /> ডেটা লোড
                        হচ্ছে...
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length > 0 ? (
                  paginatedProducts.map((product) => {
                    const totalStock = calculateTotalStock(product);
                    const isPack =
                      product.inventoryType === "pack" &&
                      product.packs &&
                      product.packs.length > 0;
                    const isChecked = selectedIds.includes(product.id);

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-slate-50/50 transition ${
                          isChecked ? "bg-slate-50" : ""
                        }`}
                      >
                        <td className="p-4 align-middle text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(product.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-slate-900 align-middle"
                          />
                        </td>
                        <td className="p-4 align-middle font-bold text-slate-800">
                          {product.name}
                        </td>
                        <td className="p-4 align-middle text-slate-500 font-mono text-xs">
                          {product.sku}
                        </td>
                        <td className="p-4 align-middle text-slate-600">
                          {product.category?.name || product.category || "N/A"}
                        </td>
                        <td className="p-4 align-middle text-slate-600">
                          {product.brand?.name || product.brand || "N/A"}
                        </td>
                        <td className="p-4 align-middle text-emerald-600 font-semibold">
                          ৳{product.purchasePrice?.toFixed(2) || "0.00"}
                        </td>
                        <td className="p-4 align-middle text-slate-600">
                          ৳{product.sellingPrice?.toFixed(2) || "0.00"}
                        </td>

                        {/* স্টক কোয়ান্টিটি কলাম (অ্যালাইনমেন্ট ঠিক করা হয়েছে) */}
                        <td className="p-4 align-middle">
                          {isPack ? (
                            <button
                              onClick={() => setSelectedProductPacks(product)}
                              className="font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
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
                            <span className="font-semibold text-slate-700 inline-block">
                              {totalStock} {product.baseUnit || "Pcs"}
                            </span>
                          )}
                        </td>

                        <td className="p-4 align-middle">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg inline-block ${
                              product.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                                : "bg-rose-50 text-rose-600 border border-rose-200/50"
                            }`}
                          >
                            {product.status || "ACTIVE"}
                          </span>
                        </td>

                        <td className="p-4 align-middle text-center">
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
                      colSpan="10"
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

          <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <p>
              Showing{" "}
              {filteredProducts.length === 0
                ? 0
                : (currentPage - 1) * ITEMS_PER_PAGE + 1}{" "}
              to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}{" "}
              of {filteredProducts.length} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-100 disabled:hover:bg-white transition"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-100 disabled:hover:bg-white transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedProductPacks && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  {selectedProductPacks.name}
                </h3>
                <p className="text-xs text-slate-500">
                  প্যাক অনুযায়ী স্টক বিবরণী
                </p>
              </div>
              <button
                onClick={() => setSelectedProductPacks(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

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
