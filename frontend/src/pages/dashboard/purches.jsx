import React, { useState, useEffect } from "react";

// API Base URL - এক জায়গায় পরিবর্তন করলেই পুরো কোডে কাজ করবে
const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function PurchaseManagement() {
  const [activeTab, setActiveTab] = useState("list");

  // Data States
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Edit Tracking States
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);

  // Add/Edit Purchase ফর্মের স্টেটগুলো
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  // Add/Edit Supplier ফর্মের স্টেটগুলো
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supNote, setSupNote] = useState("");

  const totalAmount = Number(quantity) * Number(unitPrice) || 0;

  // -----------------------------------------
  // API Fetch Functions (Backend Integration)
  // -----------------------------------------

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/purchases`);
      const data = await response.json();
      setPurchases(data);
    } catch (error) {
      console.error("Error fetching purchases:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const currentShopId = localStorage.getItem('shopId'); // শপ আইডি নিয়ে আসা হচ্ছে
      
      // শপ আইডি যুক্ত করে রিকোয়েস্ট পাঠানো (যদি ব্যাকএন্ডে কুয়েরি ফিল্টার থাকে)
      const url = currentShopId 
        ? `${API_BASE_URL}/suppliers?shopId=${currentShopId}` 
        : `${API_BASE_URL}/suppliers`;

      const response = await fetch(url);
      const result = await response.json();
      
      // ব্যাকএন্ড থেকে যদি { success: true, data: [...] } আকারে ডেটা আসে
      if (result.success && Array.isArray(result.data)) {
        setSuppliers(result.data);
      } else if (Array.isArray(result)) {
        // যদি সরাসরি অ্যারে রিটার্ন করে
        setSuppliers(result);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
  }, []);

  // -----------------------------------------
  // Purchase Actions (Create, Update, Delete)
  // -----------------------------------------

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    const purchaseData = {
      supplier_id: supplierId,
      date,
      payment_status: paymentStatus,
      product,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      total_amount: totalAmount,
      note,
    };

    try {
      const url = editingPurchaseId
        ? `${API_BASE_URL}/purchases/${editingPurchaseId}`
        : `${API_BASE_URL}/purchases`;
      
      const method = editingPurchaseId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseData),
      });

      if (response.ok) {
        alert(editingPurchaseId ? "Purchase updated successfully!" : "Purchase saved successfully!");
        fetchPurchases();
        setActiveTab("list");
        resetPurchaseForm();
      } else {
        alert("Failed to save purchase.");
      }
    } catch (error) {
      console.error("Error saving purchase:", error);
    }
  };

  const handleEditPurchase = (item) => {
    setEditingPurchaseId(item.id);
    setSupplierId(item.supplier_id || item.supplierId || "");
    setDate(item.date || "");
    setPaymentStatus(item.paymentStatus || item.payment_status || "Paid");
    setProduct(item.product || "");
    setQuantity(item.quantity || "");
    setUnitPrice(item.unitPrice || item.unit_price || "");
    setNote(item.note || "");
    setActiveTab("add");
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm("Are you sure you want to delete this purchase?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/purchases/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("Purchase deleted successfully!");
        fetchPurchases();
      } else {
        alert("Failed to delete purchase.");
      }
    } catch (error) {
      console.error("Error deleting purchase:", error);
    }
  };

  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setSupplierId("");
    setDate("");
    setPaymentStatus("Paid");
    setProduct("");
    setQuantity("");
    setUnitPrice("");
    setNote("");
  };

  // -----------------------------------------
  // Supplier Actions (Create, Update, Delete)
  // -----------------------------------------

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    
    // আপনার লোকাল স্টোরেজ বা ইউজার স্টেট থেকে current shopId এখানে নিয়ে আসবেন
    // উদাহরণস্বরূপ: localStorage.getItem('shopId') অথবা আপনার অ্যাপের শপ আইডি ভেরিয়েবল
    const currentShopId = localStorage.getItem('shopId'); // বা আপনার প্রজেক্ট অনুযায়ী শপ আইডি পাওয়ার পদ্ধতি

    const supplierData = {
      name: supName,
      phone: supPhone,
      address: supAddress,
      note: supNote,
      shopId: Number(currentShopId), // shopId এখানে যোগ করা হলো
    };

    try {
      const url = editingSupplierId
        ? `${API_BASE_URL}/suppliers/${editingSupplierId}`
        : `${API_BASE_URL}/suppliers`;

      const method = editingSupplierId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          // যদি টোকেন বা অথেন্টিকেশন লাগে তা এখানে দিতে পারেন
          // "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(supplierData),
      });

      if (response.ok) {
        alert(editingSupplierId ? "Supplier updated successfully!" : "Supplier added successfully!");
        fetchSuppliers();
        resetSupplierForm();
        setActiveTab("suppliers");
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert("Failed to save supplier.");
      }
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
  };

  const handleEditSupplier = (sup) => {
    setEditingSupplierId(sup.id);
    setSupName(sup.name || "");
    setSupPhone(sup.phone || "");
    setSupAddress(sup.address || "");
    setSupNote(sup.note || "");
    setActiveTab("add-supplier");
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("Supplier deleted successfully!");
        fetchSuppliers();
      } else {
        alert("Failed to delete supplier.");
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    }
  };

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupName("");
    setSupPhone("");
    setSupAddress("");
    setSupNote("");
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Top Header & Navigation Tabs */}
        <div className="bg-white shadow-sm rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">
            📦 Purchase Management
          </h2>

          {/* Navigation Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => { resetPurchaseForm(); setActiveTab("list"); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "list" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              📋 Purchase List
            </button>
            <button
              onClick={() => { resetPurchaseForm(); setActiveTab("add"); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "add" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              ➕ {editingPurchaseId ? "Edit Purchase" : "Add Purchase"}
            </button>
            <button
              onClick={() => { resetSupplierForm(); setActiveTab("suppliers"); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "suppliers" || activeTab === "add-supplier" ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              👥 Supplier List
            </button>
          </div>
        </div>

        {/* Tab Content 1: Purchase List */}
        {activeTab === "list" && (
          <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Recent Purchases
                </h3>
                <p className="text-xs text-gray-400">
                  Track and manage all your recent stock purchases.
                </p>
              </div>
              <button
                onClick={() => { resetPurchaseForm(); setActiveTab("add"); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                + New Purchase
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-6">Invoice</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100 text-gray-600">
                  {purchases.length > 0 ? (
                    purchases.map((item, index) => {
                      const currentStatus = item.paymentStatus || item.payment_status;
                      const currentTotal = item.totalAmount || item.total_amount;
                      
                      // Find supplier name if relation object exists or match ID
                      const supplierObj = suppliers.find(s => s.id === (item.supplier_id || item.supplierId));
                      const supplierDisplayName = item.supplier || (supplierObj ? supplierObj.name : "N/A");

                      return (
                        <tr key={item.id || index} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-4 px-6 font-semibold text-gray-800 font-mono text-xs">
                            {item.invoice || `#PUR-00${index + 1}`}
                          </td>
                          <td className="py-4 px-4 font-medium text-gray-800">
                            {supplierDisplayName}
                          </td>
                          <td className="py-4 px-4 text-xs text-gray-500">
                            {item.date}
                          </td>
                          <td className="py-4 px-4 font-semibold text-gray-800 text-xs">
                            ৳ {currentTotal}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${
                              currentStatus === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                : 'bg-amber-50 text-amber-600 border-amber-150'
                            }`}>
                              {currentStatus}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            <button
                              onClick={() => handleEditPurchase(item)}
                              className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded-lg transition text-xs"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(item.id)}
                              className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition text-xs"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-400 text-xs">
                        No purchase records found. Add a new one!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 2: Add/Edit Purchase Form */}
        {activeTab === "add" && (
          <div className="bg-white shadow-lg rounded-xl p-8">
            <div className="border-b pb-4 mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingPurchaseId ? "✏️ Edit Purchase Record" : "🛒 Add New Purchase / Stock In"}
              </h3>
              <p className="text-sm text-gray-500">
                {editingPurchaseId ? "Update existing purchase information." : "Record new stock items and update inventory automatically."}
              </p>
            </div>

            <form onSubmit={handleSavePurchase}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Name *
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full border rounded-lg p-2.5 bg-white outline-none"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Status *
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full border rounded-lg p-2.5 outline-none bg-white"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Due">Due</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>
              </div>

              <div className="mb-6 border rounded-xl p-5 bg-gray-50">
                <h4 className="text-md font-semibold text-gray-700 mb-4">
                  Product Details & Quantity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Select Product *
                    </label>
                    <input
                      type="text"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      placeholder="e.g. Miniket Rice"
                      className="w-full border rounded-lg p-2.5 bg-white outline-none"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="w-full border rounded-lg p-2.5 bg-white outline-none"
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Unit Buying Price (৳) *
                    </label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full border rounded-lg p-2.5 bg-white outline-none"
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Total (৳)
                    </label>
                    <input
                      type="text"
                      value={`৳ ${totalAmount.toFixed(2)}`}
                      readOnly
                      className="w-full border rounded-lg p-2.5 bg-gray-200 text-gray-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note / Comments
                </label>
                <textarea
                  rows="2"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional purchase notes..."
                  className="w-full border rounded-lg p-2.5 outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => { resetPurchaseForm(); setActiveTab("list"); }}
                  className="px-5 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-100 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md"
                >
                  {editingPurchaseId ? "Update Purchase" : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Content 3: Supplier List */}
        {activeTab === "suppliers" && (
          <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Supplier Directory
                </h3>
                <p className="text-xs text-gray-400">
                  Manage your suppliers and vendors here.
                </p>
              </div>
              <button
                onClick={() => { resetSupplierForm(); setActiveTab("add-supplier"); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                + Add Supplier
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-6">Supplier Name</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Address</th>
                    <th className="py-3.5 px-4">Note</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100 text-gray-600">
                  {suppliers.length > 0 ? (
                    suppliers.map((sup, index) => (
                      <tr key={sup.id || index} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gray-800 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {sup.name ? sup.name.substring(0, 2).toUpperCase() : "SU"}
                          </div>
                          {sup.name}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-gray-600">
                          {sup.phone}
                        </td>
                        <td className="py-4 px-4 text-gray-500 text-xs">
                          {sup.address || "N/A"}
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-500 max-w-[220px]">
                          <p className="truncate" title={sup.note}>
                            {sup.note || "No note added"}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => handleEditSupplier(sup)}
                            className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded-lg transition text-xs"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(sup.id)}
                            className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition text-xs"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-gray-400 text-xs">
                        No suppliers found. Please add a supplier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sub Tab: Add/Edit Supplier Form */}
        {activeTab === "add-supplier" && (
          <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-8 max-w-3xl mx-auto">
            <div className="border-b border-gray-100 pb-4 mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {editingSupplierId ? "✏️ Edit Supplier Details" : "👤 Add New Supplier"}
              </h3>
              <p className="text-xs text-gray-400">
                {editingSupplierId ? "Modify existing vendor information." : "Fill up the information below to register a new vendor."}
              </p>
            </div>

            <form onSubmit={handleSaveSupplier}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="e.g. Acme Traders"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Address
                  </label>
                  <textarea
                    rows="2"
                    value={supAddress}
                    onChange={(e) => setSupAddress(e.target.value)}
                    placeholder="Supplier location or address..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
                  ></textarea>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Note / Description
                  </label>
                  <textarea
                    rows="3"
                    value={supNote}
                    onChange={(e) => setSupName(e.target.value) /* Fixed typo handling supNote below */}
                    // corrected below line:
                    onChange={(e) => setSupNote(e.target.value)}
                    placeholder="Add any extra notes regarding this supplier..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => { resetSupplierForm(); setActiveTab("suppliers"); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition text-xs font-semibold"
                >
                  {editingSupplierId ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}