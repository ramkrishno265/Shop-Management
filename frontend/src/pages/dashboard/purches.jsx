import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function InventoryManagement() {
  // activeTab অপশনগুলো: "purchase_list", "purchase_add", "supplier_list", "supplier_add"
  const [activeTab, setActiveTab] = useState("purchase_list");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");

  // Data States
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  // Edit Tracking States
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);

  // Purchase Form States
  const [supplierId, setSupplierId] = useState("");
  const [supplierNumber, setSupplierNumber] = useState("");
  const [date, setDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [product, setProduct] = useState("");
  // ✅ নতুন: শুধু নাম না, প্রোডাক্টের পুরো রেকর্ড ট্র্যাক করা হচ্ছে যাতে inventoryType
  // ও packs জানা যায় — এটা ছাড়া pack প্রোডাক্ট সঠিকভাবে restock করা সম্ভব না।
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  // Supplier Form States
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supNote, setSupNote] = useState("");

  const isPackProduct = selectedProduct?.inventoryType === 'pack';
  const selectedPack = isPackProduct
    ? (selectedProduct?.packs || []).find((p) => String(p.id) === String(selectedPackId))
    : null;

  // Calculations
  const totalAmount = Number(quantity) * Number(unitPrice) || 0;
  const dueAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0));
  // শুধু তথ্যের জন্য: pack হলে এই purchase-এ আসলে কত base-unit স্টক যোগ হবে তা দেখানো,
  // যাতে ইউজার সেভ করার আগেই বুঝতে পারে (backend-ও একই হিসাব করবে)
  const baseUnitsToAdd = isPackProduct && selectedPack
    ? (Number(quantity) || 0) * (Number(selectedPack.multiplier) || 1)
    : Number(quantity) || 0;

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json();
      setProducts(result.success && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []));
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const currentShopId = localStorage.getItem('shopId');
      const url = currentShopId ? `${API_BASE_URL}/purchases?shopId=${currentShopId}` : `${API_BASE_URL}/purchases`;
      
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setPurchases(data.success && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error("Error fetching purchases:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const currentShopId = localStorage.getItem('shopId');
      const url = currentShopId ? `${API_BASE_URL}/suppliers?shopId=${currentShopId}` : `${API_BASE_URL}/suppliers`;
      
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json();
      setSuppliers(result.success && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []));
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleSupplierChange = (e) => {
    const selectedId = e.target.value;
    setSupplierId(selectedId);
    const foundSupplier = suppliers.find((sup) => sup.id == selectedId);
    setSupplierNumber(foundSupplier ? (foundSupplier.phone || foundSupplier.number || '') : '');
  };

  // ✅ নতুন: প্রোডাক্ট সিলেক্ট করার সময় পুরো রেকর্ড সেভ করা এবং pack selection রিসেট করা
  const handleSelectProduct = (p) => {
    const pName = typeof p === 'string' ? p : (p.name || p.product_name || '');
    setProduct(pName);
    setSelectedProductId(p.id || "");
    setSelectedProduct(p);
    setSelectedPackId("");
    setUnitPrice("");
    setIsDropdownOpen(false);
  };

  const handleSelectPack = (e) => {
    const packId = e.target.value;
    setSelectedPackId(packId);
    const pack = (selectedProduct?.packs || []).find((p) => String(p.id) === String(packId));
    if (pack) {
      // pack নির্বাচন করলে ইউনিট প্রাইস ফিল্ডে ডিফল্ট হিসেবে "প্রতি প্যাকের ক্রয়মূল্য" বসিয়ে দেওয়া (ইউজার চাইলে বদলাতে পারবে)
      setUnitPrice(pack.purchasePrice || "");
    }
  };

  // Save / Update Purchase
  const handleSavePurchase = async (e) => {
    e.preventDefault();

    let currentShopId = localStorage.getItem('shopId') || localStorage.getItem('shop_id');

    if (!currentShopId) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          currentShopId = parsedUser.shopId || parsedUser.shop_id;
        } catch (err) {
          console.error("Error parsing user from localStorage", err);
        }
      }
    }

    if (!currentShopId) {
      alert("Shop ID is missing! Please select or log into a shop first.");
      return;
    }

    if (!selectedProductId) {
      alert("দয়া করে লিস্ট থেকে একটি প্রোডাক্ট নির্বাচন করুন।");
      return;
    }

    if (isPackProduct && !selectedPackId) {
      alert("এটি একটি Pack প্রোডাক্ট। কোন প্যাক (যেমন: ২৫ কেজি বস্তা) দিয়ে কেনা হয়েছে তা নির্বাচন করুন।");
      return;
    }

    const purchaseData = {
      shopId: currentShopId,
      supplier_id: supplierId,
      date,
      payment_status: paymentStatus,
      product,
      productId: selectedProductId,
      // ✅ pack হলে packId পাঠানো — backend এটা দিয়ে multiplier বের করে quantity/unit_price
      // কে base-unit-এ কনভার্ট করবে। standard প্রোডাক্টে এটা undefined থাকবে।
      packId: isPackProduct ? selectedPackId : undefined,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      total_amount: totalAmount,
      paid_amount: Number(paidAmount) || 0,
      due_amount: dueAmount,
      note,
    };

    try {
      const url = editingPurchaseId ? `${API_BASE_URL}/purchases/${editingPurchaseId}` : `${API_BASE_URL}/purchases`;
      const response = await fetch(url, {
        method: editingPurchaseId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify(purchaseData),
      });

      const result = await response.json();

      if (response.ok) {
        alert(editingPurchaseId ? "Purchase updated successfully!" : "Purchase saved successfully!");
        fetchPurchases();
        fetchProducts(); // স্টক আপডেট রিফ্লেক্ট করার জন্য
        setActiveTab("purchase_list");
        resetPurchaseForm();
      } else {
        alert(`Failed: ${result.message || result.error || "Failed to save purchase."}`);
      }
    } catch (error) {
      console.error("Error saving purchase:", error);
    }
  };

  // Save / Update Supplier
  const handleSaveSupplier = async (e) => {
    e.preventDefault();

    let currentShopId = localStorage.getItem('shopId') || localStorage.getItem('shop_id');

    if (!currentShopId) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          currentShopId = parsedUser.shopId || parsedUser.shop_id;
        } catch (err) {
          console.error("Error parsing user from localStorage", err);
        }
      }
    }

    if (!supName) {
      alert("Please enter a supplier name.");
      return;
    }

    if (!currentShopId) {
      alert("Shop ID is missing! Please select or log into a shop first.");
      return;
    }

    const supplierData = {
      name: supName,
      phone: supPhone || "",
      address: supAddress || "",
      note: supNote || "",
      shopId: currentShopId,
    };

    try {
      const url = editingSupplierId
        ? `${API_BASE_URL}/suppliers/${editingSupplierId}`
        : `${API_BASE_URL}/suppliers`;

      const response = await fetch(url, {
        method: editingSupplierId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify(supplierData),
      });

      const result = await response.json();

      if (response.ok) {
        alert(editingSupplierId ? "Supplier updated successfully!" : "Supplier added successfully!");
        fetchSuppliers();
        setActiveTab("supplier_list");
        resetSupplierForm();
      } else {
        alert(`Failed: ${result.message || result.error || "Bad Request"}`);
      }
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
  };

  const handleEditPurchase = (item) => {
    setEditingPurchaseId(item.id);
    const sId = item.supplier_id || item.supplierId || "";
    setSupplierId(sId);
    const foundSupplier = suppliers.find((sup) => sup.id == sId);
    setSupplierNumber(foundSupplier ? (foundSupplier.phone || foundSupplier.number || '') : '');
    setPaidAmount(item.paidAmount || item.paid_amount || "");
    setDate(item.date || "");
    setPaymentStatus(item.paymentStatus || item.payment_status || "Paid");
    setProduct(item.product || "");
    setQuantity(item.quantity || "");
    setUnitPrice(item.unitPrice || item.unit_price || "");
    setNote(item.note || "");

    // ✅ এডিটের সময় প্রোডাক্ট ও প্যাক তথ্যও রিস্টোর করা, নাহলে pack প্রোডাক্ট আপডেট করলে
    // আবার সেই পুরনো non-pack-aware বাগে ফিরে যাবে।
    const purchaseItem = item.purchaseItems?.[0];
    const linkedProductId = purchaseItem?.productId || item.productId || "";
    const foundProduct = products.find((p) => String(p.id) === String(linkedProductId));
    setSelectedProductId(linkedProductId);
    setSelectedProduct(foundProduct || null);
    setSelectedPackId(item.packId || item.pack?.id || "");

    setActiveTab("purchase_add");
  };

  const handleEditSupplier = (sup) => {
    setEditingSupplierId(sup.id);
    setSupName(sup.name || "");
    setSupPhone(sup.phone || sup.phone_number || sup.number || "");
    setSupAddress(sup.address || "");
    setSupNote(sup.note || "");
    setActiveTab("supplier_add");
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm("Are you sure you want to delete this purchase?")) return;
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/purchases/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        alert("Purchase deleted successfully!");
        fetchPurchases();
        fetchProducts();
      } else {
        // ✅ নতুন: ডিলিট এখন block হতে পারে (যদি এই পারচেজ থেকে ইতিমধ্যে বিক্রি হয়ে থাকে) —
        // আগে এই এরর কখনো দেখানো হতো না কারণ ব্যাকএন্ড আগে কখনো fail-ই করত না।
        alert(`Failed: ${result.message || "Could not delete purchase."}`);
      }
    } catch (error) {
      console.error("Error deleting purchase:", error);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Supplier deleted successfully!");
        fetchSuppliers();
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    }
  };

  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setSupplierId("");
    setSupplierNumber("");
    setPaidAmount("");
    setDate("");
    setPaymentStatus("Paid");
    setProduct("");
    setSelectedProductId("");
    setSelectedProduct(null);
    setSelectedPackId("");
    setQuantity("");
    setUnitPrice("");
    setNote("");
  };

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupName("");
    setSupPhone("");
    setSupAddress("");
    setSupNote("");
  };
  return (
    <div className=" mx-auto px-4  bg-gray-50/50 min-h-screen">
      {/* Standard Header Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-fit">
        <button
          onClick={() => { setActiveTab("purchase_list"); resetPurchaseForm(); }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "purchase_list" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-gray-600 hover:bg-gray-100/80"
            }`}
        >
          📋 Purchase List
        </button>
        <button
          onClick={() => { setActiveTab("purchase_add"); resetPurchaseForm(); }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "purchase_add" ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-gray-600 hover:bg-gray-100/80"
            }`}
        >
          {editingPurchaseId ? "✏️ Edit Purchase" : "➕ Add Purchase"}
        </button>
        <button
          onClick={() => { setActiveTab("supplier_list"); resetSupplierForm(); }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "supplier_list" ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "text-gray-600 hover:bg-gray-100/80"
            }`}
        >
          🏢 Supplier List
        </button>
        <button
          onClick={() => { setActiveTab("supplier_add"); resetSupplierForm(); }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "supplier_add" ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "text-gray-600 hover:bg-gray-100/80"
            }`}
        >
          {editingSupplierId ? "✏️ Edit Supplier" : "➕ Add Supplier"}
        </button>
      </div>

      {/* 1. Purchase List View */}
      {activeTab === "purchase_list" && (
        <div className="bg-white shadow-xl shadow-gray-100 border border-gray-100 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Purchase Records</h3>
              <p className="text-xs text-gray-400 mt-1">Manage and view all your stock purchases.</p>
            </div>
            <button
              onClick={() => { resetPurchaseForm(); setActiveTab("purchase_add"); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shadow-blue-500/20"
            >
              + New Purchase
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Product</th>
                  <th className="p-4 font-bold">Quantity</th>
                  <th className="p-4 font-bold">Unit Price</th>
                  <th className="p-4 font-bold">Total</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {purchases.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 text-gray-400 font-medium">No purchase records found.</td></tr>
                ) : (
                  purchases.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition">
                      <td className="p-4 text-gray-600 font-medium">{item.date}</td>
                      <td className="p-4 font-semibold text-gray-800">
                        {item.product}
                        {item.pack?.packName && (
                          <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full align-middle">
                            {item.pack.packName}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-600">{item.quantity}</td>
                      <td className="p-4 text-gray-600 font-mono">৳{item.unit_price || item.unitPrice}</td>
                      <td className="p-4 font-bold text-gray-900 font-mono">৳{item.total_amount || item.totalAmount}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(item.payment_status || item.paymentStatus) === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                          {item.payment_status || item.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => handleEditPurchase(item)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition">Edit</button>
                        <button onClick={() => handleDeletePurchase(item.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Add / Edit Purchase Form */}
      {activeTab === "purchase_add" && (
        <div className="bg-white shadow-xl shadow-gray-100 border border-gray-100 rounded-3xl p-6 md:p-10 max-w-4xl mx-auto">
          <div className="border-b border-gray-100 pb-5 mb-8 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">
                {editingPurchaseId ? "✏️ Edit Purchase Record" : "🛒 Add New Purchase / Stock In"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Record new stock items to update your system inventory.</p>
            </div>
            <span className="px-3.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
              {editingPurchaseId ? "Mode: Update" : "Mode: Create"}
            </span>
          </div>

          <form onSubmit={handleSavePurchase} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={handleSupplierChange}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium text-gray-700"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Supplier Number
                </label>
                <input
                  type="text"
                  value={supplierNumber}
                  readOnly
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-gray-50 text-gray-500 outline-none cursor-not-allowed font-mono"
                  placeholder="Auto-filled"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Purchase Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                  required
                />
              </div>
            </div>

            <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/50">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">📦 Product Details & Pricing</h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Product <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={product}
                    onChange={(e) => {
                      setProduct(e.target.value);
                      setSelectedProductId("");
                      setSelectedProduct(null);
                      setSelectedPackId("");
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Type to search product..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium"
                    required
                  />
                  {isDropdownOpen && product && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl divide-y divide-gray-100">
                      {products
                        .filter((p) => {
                          const pName = typeof p === 'string' ? p : (p.name || p.product_name || '');
                          return pName.toLowerCase().includes(product.toLowerCase());
                        })
                        .map((p, index) => {
                          const pName = typeof p === 'string' ? p : (p.name || p.product_name || '');
                          return (
                            <li
                              key={p.id || index}
                              onClick={() => handleSelectProduct(p)}
                              className="p-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer font-medium flex items-center justify-between"
                            >
                              <span>{pName}</span>
                              {p.inventoryType === 'pack' && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Pack</span>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>

                {/* ✅ নতুন: Pack প্রোডাক্ট হলে কোন প্যাক দিয়ে কেনা হচ্ছে তা বেছে নেওয়ার ড্রপডাউন।
                    এটা ছাড়া backend জানতেই পারে না multiplier কত, ফলে base-unit স্টক ভুল হয়ে যায়। */}
                {isPackProduct && (
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pack Type <span className="text-red-500">*</span></label>
                    <select
                      value={selectedPackId}
                      onChange={handleSelectPack}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium"
                      required
                    >
                      <option value="">Select Pack</option>
                      {(selectedProduct?.packs || []).map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.packName} (× {pack.multiplier})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={isPackProduct ? "md:col-span-2" : "md:col-span-2"}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isPackProduct ? "No. of Packs" : "Quantity"} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium" required />
                </div>

                <div className={isPackProduct ? "md:col-span-3" : "md:col-span-3"}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isPackProduct ? "Price per Pack (৳)" : "Unit Price (৳)"} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium" required />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Amount (৳)</label>
                  <input type="text" value={`৳ ${totalAmount.toFixed(2)}`} readOnly className="w-full border border-blue-200 rounded-xl p-3 text-sm bg-blue-50/50 text-blue-700 font-bold font-mono" />
                </div>

                {isPackProduct && selectedPack && (
                  <div className="md:col-span-12">
                    <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-3">
                      স্টকে যোগ হবে: <span className="font-bold text-gray-800">{baseUnitsToAdd} {selectedProduct?.baseUnit || 'Pcs'}</span>
                      {' '}(প্রতি {selectedProduct?.baseUnit || 'unit'}-এর ক্রয়মূল্য ≈ ৳{selectedPack.multiplier > 0 ? (Number(unitPrice) / Number(selectedPack.multiplier)).toFixed(2) : '0.00'})
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/50">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">💳 Payment & Due Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Status <span className="text-red-500">*</span></label>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold">
                    <option value="Paid" className="text-emerald-600">Paid</option>
                    <option value="Due" className="text-red-600">Due</option>
                    <option value="Partial" className="text-amber-600">Partial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Paid Amount (৳)</label>
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Amount (৳)</label>
                  <input type="text" value={`৳ ${dueAmount.toFixed(2)}`} readOnly className="w-full border border-red-200 rounded-xl p-3 text-sm bg-red-50/50 text-red-700 font-bold font-mono" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Note / Comments</label>
              <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add extra notes..." className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium"></textarea>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
              <button type="button" onClick={() => { resetPurchaseForm(); setActiveTab("purchase_list"); }} className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition text-xs font-bold">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition text-xs font-bold">{editingPurchaseId ? "Update Purchase" : "Save Purchase"}</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Supplier List View */}
      {activeTab === "supplier_list" && (
        <div className="bg-white shadow-xl shadow-gray-100 border border-gray-100 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Supplier Directory</h3>
              <p className="text-xs text-gray-400 mt-1">Manage all your product suppliers and vendors.</p>
            </div>
            <button
              onClick={() => { resetSupplierForm(); setActiveTab("supplier_add"); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-500/20"
            >
              + Add Supplier
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">Supplier Name</th>
                  <th className="p-4 font-bold">Phone Number</th>
                  <th className="p-4 font-bold">Address</th>
                  <th className="p-4 font-bold">Note</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {suppliers.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-medium">No suppliers found.</td></tr>
                ) : (
                  suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-gray-50/60 transition">
                      <td className="p-4 font-semibold text-gray-800">{sup.name}</td>
                      <td className="p-4 text-gray-600 font-mono">{sup.phone || sup.phone_number || sup.number || 'N/A'}</td>
                      <td className="p-4 text-gray-600">{sup.address || 'N/A'}</td>
                      <td className="p-4 text-gray-500 text-xs">{sup.note || '-'}</td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => handleEditSupplier(sup)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition">Edit</button>
                        <button onClick={() => handleDeleteSupplier(sup.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Add / Edit Supplier Form */}
      {activeTab === "supplier_add" && (
        <div className="bg-white shadow-xl shadow-gray-100 border border-gray-100 rounded-3xl p-6 md:p-10 max-w-2xl mx-auto">
          <div className="border-b border-gray-100 pb-5 mb-8 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">
                {editingSupplierId ? "✏️ Edit Supplier Details" : "🏢 Add New Supplier"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Register a new vendor or supplier to your network.</p>
            </div>
            <span className="px-3.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
              {editingSupplierId ? "Mode: Update" : "Mode: Create"}
            </span>
          </div>

          <form onSubmit={handleSaveSupplier} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Supplier Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="Enter supplier or company name"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Phone Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Address</label>
              <input
                type="text"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                placeholder="Shop location / City / Area"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Note / Description</label>
              <textarea
                rows="3"
                value={supNote}
                onChange={(e) => setSupNote(e.target.value)}
                placeholder="Optional supplier notes..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
              <button type="button" onClick={() => { resetSupplierForm(); setActiveTab("supplier_list"); }} className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition text-xs font-bold">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20 transition text-xs font-bold">{editingSupplierId ? "Update Supplier" : "Save Supplier"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}