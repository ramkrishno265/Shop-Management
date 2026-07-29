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
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  // Supplier Form States
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supNote, setSupNote] = useState("");

  // Calculations
  const totalAmount = Number(quantity) * Number(unitPrice) || 0;
  const dueAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0));

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
      const currentShopId = localStorage.getItem('shopId');
      const url = currentShopId ? `${API_BASE_URL}/purchases?shopId=${currentShopId}` : `${API_BASE_URL}/purchases`;
      const response = await fetch(url);
      const data = await response.json();
      setPurchases(data.success && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error("Error fetching purchases:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const currentShopId = localStorage.getItem('shopId');
      const url = currentShopId ? `${API_BASE_URL}/suppliers?shopId=${currentShopId}` : `${API_BASE_URL}/suppliers`;
      const response = await fetch(url);
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

  // Save / Update Purchase
  const handleSavePurchase = async (e) => {
    e.preventDefault();

    // শপ আইডি সংগ্রহ (সাপ্লাইয়ারের মতোই লোকালস্টোরেজ বা ইউজার অবজেক্ট থেকে)
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

    const purchaseData = {
      shopId: currentShopId, // এখানে শপ আইডি যুক্ত করা হলো
      supplier_id: supplierId,
      date,
      payment_status: paymentStatus,
      product,
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

    // ১. প্রথমে সরাসরি shopId চেক করবে, না পেলে user অবজেক্ট থেকে বের করবে
    let currentShopId = localStorage.getItem('shopId') || localStorage.getItem('shop_id');

    if (!currentShopId) {
      const storedUser = localStorage.getItem('user'); // অথবা আপনার ইউজার ডেটার কি (key) নাম যা থাকে
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
      const response = await fetch(`${API_BASE_URL}/purchases/${id}`, { method: "DELETE" });
      if (response.ok) {
        alert("Purchase deleted successfully!");
        fetchPurchases();
      }
    } catch (error) {
      console.error("Error deleting purchase:", error);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { method: "DELETE" });
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
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gray-50/50 min-h-screen">
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
                      <td className="p-4 font-semibold text-gray-800">{item.product}</td>
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
                    onChange={(e) => { setProduct(e.target.value); setIsDropdownOpen(true); }}
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
                              onClick={() => {
                                setProduct(pName);
                                if (p.buying_price || p.unitPrice || p.price) {
                                  setUnitPrice(p.buying_price || p.unitPrice || p.price);
                                }
                                setIsDropdownOpen(false);
                              }}
                              className="p-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer font-medium"
                            >
                              {pName}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium" required />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit Price (৳) <span className="text-red-500">*</span></label>
                  <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium" required />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Amount (৳)</label>
                  <input type="text" value={`৳ ${totalAmount.toFixed(2)}`} readOnly className="w-full border border-blue-200 rounded-xl p-3 text-sm bg-blue-50/50 text-blue-700 font-bold font-mono" />
                </div>
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