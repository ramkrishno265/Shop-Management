import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState("purchase_list");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");

  const location = useLocation();
  const prefillProcessedRef = useRef(false);

  // Data States
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  // Edit Tracking States
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);

  // Purchase Form States
  const [invoiceNo, setInvoiceNo] = useState(""); // ✅ নতুন: Purchase Invoice No
  const [supplierId, setSupplierId] = useState("");
  const [supplierNumber, setSupplierNumber] = useState("");
  const [date, setDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [note, setNote] = useState("");
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);

  // Staging Product States
  const [product, setProduct] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const [cartItems, setCartItems] = useState([]);
  const [selectedPurchaseForDetails, setSelectedPurchaseForDetails] =
    useState(null);

  // Supplier Form States
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supNote, setSupNote] = useState("");
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  const isPackProduct = selectedProduct?.inventoryType === "pack";
  const selectedPack = isPackProduct
    ? (selectedProduct?.packs || []).find(
        (p) => String(p.id) === String(selectedPackId),
      )
    : null;

  const stagingTotal = Number(quantity) * Number(unitPrice) || 0;
  const stagingBaseUnitsToAdd =
    isPackProduct && selectedPack
      ? (Number(quantity) || 0) * (Number(selectedPack.multiplier) || 1)
      : Number(quantity) || 0;

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (Number(item.totalAmount) || 0),
    0,
  );
  const dueAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0));

  const getPurchaseItemProductName = (pi) => {
    if (!pi) return "N/A";
    if (typeof pi.product === "string" && pi.product.trim() !== "") {
      return pi.product;
    }
    if (pi.productName && pi.productName.trim() !== "") return pi.productName;
    if (pi.product_name && pi.product_name.trim() !== "")
      return pi.product_name;
    if (pi.product?.name) return pi.product.name;
    if (pi.Product?.name) return pi.Product.name;

    const linkedId = pi.productId || pi.product_id;
    if (linkedId) {
      const found = products.find((p) => String(p.id) === String(linkedId));
      if (found) return found.name || found.product_name || "N/A";
    }
    return "N/A";
  };

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (prefillProcessedRef.current) return;
    if (!location.state?.productId) return;
    if (products.length === 0) return;

    const found = products.find(
      (p) => String(p.id) === String(location.state.productId),
    );

    if (found) {
      handleSelectProduct(found);
    } else {
      setProduct(location.state.productName || "");
    }

    setDate((prev) => prev || new Date().toISOString().split("T")[0]);
    setActiveTab("purchase_add");

    prefillProcessedRef.current = true;
  }, [products, location.state]);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      setProducts(
        result.success && Array.isArray(result.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [],
      );
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const currentShopId = localStorage.getItem("shopId");
      const url = currentShopId
        ? `${API_BASE_URL}/purchases?shopId=${currentShopId}`
        : `${API_BASE_URL}/purchases`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setPurchases(
        data.success && Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [],
      );
    } catch (error) {
      console.error("Error fetching purchases:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const currentShopId = localStorage.getItem("shopId");
      const url = currentShopId
        ? `${API_BASE_URL}/suppliers?shopId=${currentShopId}`
        : `${API_BASE_URL}/suppliers`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      setSuppliers(
        result.success && Array.isArray(result.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [],
      );
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleSupplierChange = (e) => {
    const selectedId = e.target.value;
    setSupplierId(selectedId);
    const foundSupplier = suppliers.find((sup) => sup.id == selectedId);
    setSupplierNumber(
      foundSupplier ? foundSupplier.phone || foundSupplier.number || "" : "",
    );
  };

  const handleSelectProduct = (p) => {
    const pName = typeof p === "string" ? p : p.name || p.product_name || "";
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
    const pack = (selectedProduct?.packs || []).find(
      (p) => String(p.id) === String(packId),
    );
    if (pack) {
      setUnitPrice(pack.purchasePrice || "");
    }
  };

  const handleAddItemToCart = () => {
    if (!selectedProductId) {
      alert("দয়া করে লিস্ট থেকে একটি প্রোডাক্ট নির্বাচন করুন।");
      return;
    }
    if (isPackProduct && !selectedPackId) {
      alert("এটি একটি Pack প্রোডাক্ট। কোন প্যাক দিয়ে কেনা হয়েছে তা নির্বাচন করুন।");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      alert("সঠিক একটি quantity দিন।");
      return;
    }
    if (!unitPrice || Number(unitPrice) < 0) {
      alert("সঠিক একটি price দিন।");
      return;
    }

    const existingIndex = cartItems.findIndex(
      (item) =>
        String(item.productId) === String(selectedProductId) &&
        String(item.packId || "") === String(selectedPackId || ""),
    );

    const newItem = {
      key: `${selectedProductId}-${selectedPackId || "std"}-${Date.now()}`,
      productId: selectedProductId,
      productName: product,
      packId: isPackProduct ? selectedPackId : undefined,
      packName: selectedPack?.packName,
      baseUnit: selectedProduct?.baseUnit || "Pcs",
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      totalAmount: stagingTotal,
      baseUnitsToAdd: stagingBaseUnitsToAdd,
    };

    if (existingIndex >= 0) {
      setCartItems((prev) => {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const mergedQty = existing.quantity + newItem.quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: mergedQty,
          unitPrice: newItem.unitPrice,
          totalAmount: mergedQty * newItem.unitPrice,
          baseUnitsToAdd:
            isPackProduct && selectedPack
              ? mergedQty * (Number(selectedPack.multiplier) || 1)
              : mergedQty,
        };
        return updated;
      });
    } else {
      setCartItems((prev) => [...prev, newItem]);
    }

    setProduct("");
    setSelectedProductId("");
    setSelectedProduct(null);
    setSelectedPackId("");
    setQuantity("");
    setUnitPrice("");
  };

  const handleRemoveCartItem = (key) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  // Save / Update Purchase
  const handleSavePurchase = async (e) => {
    e.preventDefault();

    if (isSavingPurchase) return;

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let currentShopId = user?.shopId || user?.shop_id;

    if (!currentShopId) {
      const storedUser = localStorage.getItem("user");
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

    if (!supplierId) {
      alert("দয়া করে একটি সাপ্লায়ার নির্বাচন করুন।");
      return;
    }

    if (!date) {
      alert("দয়া করে purchase date দিন।");
      return;
    }

    if (cartItems.length === 0) {
      alert("অন্তত একটি প্রোডাক্ট লিস্টে যোগ করুন (Add to List)।");
      return;
    }

    const purchaseData = {
      shopId: currentShopId,
      invoiceNo: invoiceNo || `PO-${Date.now().toString().slice(-6)}`, // ✅ ইনভয়েস নম্বর যোগ করা হয়েছে
      supplier_id: supplierId,
      date,
      payment_status: paymentStatus,
      items: cartItems.map((item) => ({
        productId: item.productId,
        product: item.productName,
        packId: item.packId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_amount: item.totalAmount,
      })),
      total_amount: totalAmount,
      paid_amount: Number(paidAmount) || 0,
      due_amount: dueAmount,
      note,
    };

    setIsSavingPurchase(true);
    try {
      const url = editingPurchaseId
        ? `${API_BASE_URL}/purchases/${editingPurchaseId}`
        : `${API_BASE_URL}/purchases`;

      const response = await fetch(url, {
        method: editingPurchaseId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify(purchaseData),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        alert(
          editingPurchaseId
            ? "Purchase updated successfully!"
            : "Purchase saved successfully!",
        );
        fetchPurchases();
        fetchProducts();
        setActiveTab("purchase_list");
        resetPurchaseForm();
      } else {
        alert(
          `Failed: ${result.message || result.error || `Server error (status ${response.status})`}`,
        );
      }
    } catch (error) {
      console.error("Error saving purchase:", error);
      alert(
        `দুঃখিত, পারচেজ সেভ করা যায়নি। ইন্টারনেট কানেকশন চেক করে আবার চেষ্টা করুন।\n(${error.message})`,
      );
    } finally {
      setIsSavingPurchase(false);
    }
  };

  // Save / Update Supplier
  const handleSaveSupplier = async (e) => {
    e.preventDefault();

    if (isSavingSupplier) return;

    let currentShopId =
      localStorage.getItem("shopId") || localStorage.getItem("shop_id");

    if (!currentShopId) {
      const storedUser = localStorage.getItem("user");
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

    setIsSavingSupplier(true);
    try {
      const url = editingSupplierId
        ? `${API_BASE_URL}/suppliers/${editingSupplierId}`
        : `${API_BASE_URL}/suppliers`;

      const response = await fetch(url, {
        method: editingSupplierId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify(supplierData),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        alert(
          editingSupplierId
            ? "Supplier updated successfully!"
            : "Supplier added successfully!",
        );
        fetchSuppliers();
        setActiveTab("supplier_list");
        resetSupplierForm();
      } else {
        alert(
          `Failed: ${result.message || result.error || `Server error (status ${response.status})`}`,
        );
      }
    } catch (error) {
      console.error("Error saving supplier:", error);
      alert(
        `দুঃখিত, সাপ্লায়ার সেভ করা যায়নি। ইন্টারনেট কানেকশন চেক করে আবার চেষ্টা করুন।\n(${error.message})`,
      );
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleEditPurchase = (item) => {
    setEditingPurchaseId(item.id);
    setInvoiceNo(item.invoiceNo || item.invoice_no || ""); // ✅ এডিট করার সময় ইনভয়েস লোড
    const sId = item.supplier_id || item.supplierId || "";
    setSupplierId(sId);
    const foundSupplier = suppliers.find((sup) => sup.id == sId);
    setSupplierNumber(
      foundSupplier ? foundSupplier.phone || foundSupplier.number || "" : "",
    );
    setPaidAmount(item.paidAmount || item.paid_amount || "");
    setDate(item.date || "");
    setPaymentStatus(item.paymentStatus || item.payment_status || "Paid");
    setNote(item.note || "");

    const items =
      Array.isArray(item.purchaseItems) && item.purchaseItems.length > 0
        ? item.purchaseItems
        : item.productId || item.product
          ? [item]
          : [];

    const restoredCartItems = items.map((pi, idx) => {
      const linkedProductId = pi.productId || pi.product_id || "";
      const foundProduct = products.find(
        (p) => String(p.id) === String(linkedProductId),
      );
      const packId = pi.packId || pi.pack_id || pi.pack?.id || "";
      const pack = (foundProduct?.packs || []).find(
        (p) => String(p.id) === String(packId),
      );
      const qty = Number(pi.quantity) || 0;
      const price = Number(pi.unitPrice || pi.unit_price) || 0;

      return {
        key: `${linkedProductId}-${packId || "std"}-${idx}`,
        productId: linkedProductId,
        productName: pi.product || foundProduct?.name || "",
        packId: packId || undefined,
        packName: pack?.packName || pi.pack?.packName,
        baseUnit: foundProduct?.baseUnit || "Pcs",
        quantity: qty,
        unitPrice: price,
        totalAmount: pi.totalAmount || pi.total_amount || qty * price,
        baseUnitsToAdd: pack ? qty * (Number(pack.multiplier) || 1) : qty,
      };
    });

    setCartItems(restoredCartItems);
    setProduct("");
    setSelectedProductId("");
    setSelectedProduct(null);
    setSelectedPackId("");
    setQuantity("");
    setUnitPrice("");

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
    if (!window.confirm("Are you sure you want to delete this purchase?"))
      return;
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/purchases/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        alert("Purchase deleted successfully!");
        fetchPurchases();
        fetchProducts();
      } else {
        alert(`Failed: ${result.message || "Could not delete purchase."}`);
      }
    } catch (error) {
      console.error("Error deleting purchase:", error);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?"))
      return;
    try {
      const token = localStorage.getItem("token") || "";
      const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        alert("Supplier deleted successfully!");
        fetchSuppliers();
      } else {
        alert("Could not delete supplier.");
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    }
  };

  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setInvoiceNo(""); // ✅ ইনভয়েস স্টেট রিসেট
    setSupplierId("");
    setSupplierNumber("");
    setPaidAmount("");
    setDate("");
    setPaymentStatus("Paid");
    setNote("");
    setProduct("");
    setSelectedProductId("");
    setSelectedProduct(null);
    setSelectedPackId("");
    setQuantity("");
    setUnitPrice("");
    setCartItems([]);
  };

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupName("");
    setSupPhone("");
    setSupAddress("");
    setSupNote("");
  };

  return (
    <div className="mx-auto px-4 bg-gray-50/50 min-h-screen">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-fit">
        <button
          onClick={() => {
            setActiveTab("purchase_list");
            resetPurchaseForm();
          }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
            activeTab === "purchase_list"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-gray-600 hover:bg-gray-100/80"
          }`}
        >
          📋 Purchase List
        </button>
        <button
          onClick={() => {
            setActiveTab("purchase_add");
            resetPurchaseForm();
          }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
            activeTab === "purchase_add"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-gray-600 hover:bg-gray-100/80"
          }`}
        >
          {editingPurchaseId ? "✏️ Edit Purchase" : "➕ Add Purchase"}
        </button>
        <button
          onClick={() => {
            setActiveTab("supplier_list");
            resetSupplierForm();
          }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
            activeTab === "supplier_list"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-gray-600 hover:bg-gray-100/80"
          }`}
        >
          🏢 Supplier List
        </button>
        <button
          onClick={() => {
            setActiveTab("supplier_add");
            resetSupplierForm();
          }}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
            activeTab === "supplier_add"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-gray-600 hover:bg-gray-100/80"
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
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">
                Purchase Records
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Manage and view all your stock purchases.
              </p>
            </div>
            <button
              onClick={() => {
                resetPurchaseForm();
                setActiveTab("purchase_add");
              }}
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
                  {/* ✅ লাল দাগের জায়গায় Invoice No হেডার */}
                  <th className="p-4 font-bold">Invoice No</th>
                  <th className="p-4 font-bold">Products</th>
                  <th className="p-4 font-bold">Items</th>
                  <th className="p-4 font-bold">Total</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-10 text-gray-400 font-medium"
                    >
                      No purchase records found.
                    </td>
                  </tr>
                ) : (
                  purchases.map((item) => {
                    const items =
                      Array.isArray(item.purchaseItems) &&
                      item.purchaseItems.length > 0
                        ? item.purchaseItems
                        : item.product
                          ? [item]
                          : [];

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/60 transition"
                      >
                        <td className="p-4 text-gray-600 font-medium">
                          {item.date}
                        </td>
                        {/* ✅ Invoice No ডেটা সেল */}
                        <td className="p-4 font-mono font-semibold text-blue-600">
                          {item.invoiceNo || item.invoice_no || `PO-${item.id}`}
                        </td>
                        <td className="p-4 font-semibold text-gray-800 max-w-xs">
                          {items.length === 0 ? (
                            "—"
                          ) : items.length === 1 ? (
                            <span>
                              {getPurchaseItemProductName(items[0])}
                              {items[0].pack?.packName && (
                                <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full align-middle">
                                  {items[0].pack.packName}
                                </span>
                              )}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPurchaseForDetails(item)
                              }
                              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-left cursor-pointer"
                              title="সব প্রোডাক্টের বিস্তারিত দেখতে ক্লিক করুন"
                            >
                              {getPurchaseItemProductName(items[0])}{" "}
                              <span className="text-gray-400 font-normal">
                                +{items.length - 1} more
                              </span>
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-gray-600">
                          {items.length || "-"}
                        </td>
                        <td className="p-4 font-bold text-gray-900 font-mono">
                          ৳{item.total_amount || item.totalAmount}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              (item.payment_status || item.paymentStatus) ===
                              "Paid"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}
                          >
                            {item.payment_status || item.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleEditPurchase(item)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(item.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
                {editingPurchaseId
                  ? "✏️ Edit Purchase Record"
                  : "🛒 Add New Purchase / Stock In"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                এক সাপ্লায়ার থেকে একাধিক প্রোডাক্ট একসাথে যোগ করতে পারবেন।
              </p>
            </div>
            <span className="px-3.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
              {editingPurchaseId ? "Mode: Update" : "Mode: Create"}
            </span>
          </div>

          <form onSubmit={handleSavePurchase} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* ✅ নতুন: Invoice Number Input */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Invoice No (Bill No)
                </label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="उदा: PO-9942 (ফাঁকা রাখলে অটো হবে)"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-mono font-medium"
                />
              </div>

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
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
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

            {/* প্রোডাক্ট স্টেজিং সেকশন */}
            <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/50">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                📦 Add Product
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Select Product
                  </label>
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
                  />
                  {isDropdownOpen && product && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl divide-y divide-gray-100">
                      {products
                        .filter((p) => {
                          const pName =
                            typeof p === "string"
                              ? p
                              : p.name || p.product_name || "";
                          return pName
                            .toLowerCase()
                            .includes(product.toLowerCase());
                        })
                        .map((p, index) => {
                          const pName =
                            typeof p === "string"
                              ? p
                              : p.name || p.product_name || "";
                          return (
                            <li
                              key={p.id || index}
                              onClick={() => handleSelectProduct(p)}
                              className="p-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer font-medium flex items-center justify-between"
                            >
                              <span>{pName}</span>
                              {p.inventoryType === "pack" && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                  Pack
                                </span>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>

                {isPackProduct && (
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Pack Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPackId}
                      onChange={handleSelectPack}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium"
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

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isPackProduct ? "No. of Packs" : "Quantity"}
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isPackProduct ? "Price / Pack (৳)" : "Unit Price (৳)"}
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 transition font-medium"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddItemToCart}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl transition shadow-md shadow-emerald-500/20"
                  >
                    + Add
                  </button>
                </div>

                {isPackProduct && selectedPack && (
                  <div className="md:col-span-12">
                    <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-3">
                      স্টকে যোগ হবে:{" "}
                      <span className="font-bold text-gray-800">
                        {stagingBaseUnitsToAdd}{" "}
                        {selectedProduct?.baseUnit || "Pcs"}
                      </span>{" "}
                      (প্রতি {selectedProduct?.baseUnit || "unit"}-এর ক্রয়মূল্য
                      ≈ ৳
                      {selectedPack.multiplier > 0
                        ? (
                            Number(unitPrice) / Number(selectedPack.multiplier)
                          ).toFixed(2)
                        : "0.00"}
                      )
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="bg-gray-50/70 px-5 py-3 border-b border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  🧾 Items in this Purchase ({cartItems.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
                      <th className="p-3 font-bold">Product</th>
                      <th className="p-3 font-bold">Qty</th>
                      <th className="p-3 font-bold">Unit Price</th>
                      <th className="p-3 font-bold">Total</th>
                      <th className="p-3 font-bold text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {cartItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-5 text-center text-gray-400"
                        >
                          এখনো কোনো প্রোডাক্ট যোগ করা হয়নি — উপরে থেকে
                          প্রোডাক্ট নির্বাচন করে "Add" চাপুন।
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item) => (
                        <tr key={item.key} className="hover:bg-gray-50/60">
                          <td className="p-3 font-semibold text-gray-800">
                            {item.productName}
                            {item.packName && (
                              <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full align-middle">
                                {item.packName}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-600">{item.quantity}</td>
                          <td className="p-3 text-gray-600 font-mono">
                            ৳{item.unitPrice}
                          </td>
                          <td className="p-3 font-bold text-gray-900 font-mono">
                            ৳{item.totalAmount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCartItem(item.key)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {cartItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50/50 border-t border-blue-100">
                        <td
                          colSpan="3"
                          className="p-3 text-right font-bold text-gray-600 text-xs uppercase"
                        >
                          Grand Total
                        </td>
                        <td
                          colSpan="2"
                          className="p-3 font-extrabold text-blue-700 font-mono"
                        >
                          ৳{totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Payment Details */}
            <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/50">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                💳 Payment & Due Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Payment Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  >
                    <option value="Paid" className="text-emerald-600">
                      Paid
                    </option>
                    <option value="Due" className="text-red-600">
                      Due
                    </option>
                    <option value="Partial" className="text-amber-600">
                      Partial
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Paid Amount (৳)
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Due Amount (৳)
                  </label>
                  <input
                    type="text"
                    value={`৳ ${dueAmount.toFixed(2)}`}
                    readOnly
                    className="w-full border border-red-200 rounded-xl p-3 text-sm bg-red-50/50 text-red-700 font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Note / Comments
              </label>
              <textarea
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add extra notes..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => {
                  resetPurchaseForm();
                  setActiveTab("purchase_list");
                }}
                className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPurchase}
                className={`px-6 py-2.5 rounded-xl shadow-md transition text-xs font-bold text-white ${isSavingPurchase ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {isSavingPurchase
                  ? "⏳ Saving..."
                  : editingPurchaseId
                    ? "Update Purchase"
                    : "Save Purchase"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Supplier List View */}
      {activeTab === "supplier_list" && (
        <div className="bg-white shadow-xl shadow-gray-100 border border-gray-100 rounded-3xl p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">
                Supplier Directory
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Manage all your product suppliers and vendors.
              </p>
            </div>
            <button
              onClick={() => {
                resetSupplierForm();
                setActiveTab("supplier_add");
              }}
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
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-10 text-gray-400 font-medium"
                    >
                      No suppliers found.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-gray-50/60 transition">
                      <td className="p-4 font-semibold text-gray-800">
                        {sup.name}
                      </td>
                      <td className="p-4 text-gray-600 font-mono">
                        {sup.phone || sup.phone_number || sup.number || "N/A"}
                      </td>
                      <td className="p-4 text-gray-600">
                        {sup.address || "N/A"}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {sup.note || "-"}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleEditSupplier(sup)}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(sup.id)}
                          className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          Delete
                        </button>
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
                {editingSupplierId
                  ? "✏️ Edit Supplier Details"
                  : "🏢 Add New Supplier"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Register a new vendor or supplier to your network.
              </p>
            </div>
            <span className="px-3.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
              {editingSupplierId ? "Mode: Update" : "Mode: Create"}
            </span>
          </div>

          <form onSubmit={handleSaveSupplier} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Supplier Name <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Address
              </label>
              <input
                type="text"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                placeholder="Shop location / City / Area"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                Note / Description
              </label>
              <textarea
                rows="3"
                value={supNote}
                onChange={(e) => setSupNote(e.target.value)}
                placeholder="Optional supplier notes..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => {
                  resetSupplierForm();
                  setActiveTab("supplier_list");
                }}
                className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSupplier}
                className={`px-6 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 transition text-xs font-bold text-white ${isSavingSupplier ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {isSavingSupplier
                  ? "⏳ Saving..."
                  : editingSupplierId
                    ? "Update Supplier"
                    : "Save Supplier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Purchase Details Modal */}
      {selectedPurchaseForDetails && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  Purchase Details
                </h3>
                {/* ✅ পপআপের ভিতরে ইনভয়েস নম্বর প্রদর্শন */}
                <p className="text-xs text-blue-600 font-mono font-bold mt-0.5">
                  Invoice: {selectedPurchaseForDetails.invoiceNo || selectedPurchaseForDetails.invoice_no || `PO-${selectedPurchaseForDetails.id}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedPurchaseForDetails.date} —{" "}
                  {(selectedPurchaseForDetails.purchaseItems || []).length} items
                </p>
              </div>
              <button
                onClick={() => setSelectedPurchaseForDetails(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(selectedPurchaseForDetails.purchaseItems || []).map(
                (pi, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">
                        {pi.product}
                        {pi.pack?.packName && (
                          <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full align-middle">
                            {pi.name} (× {pi.pack.multiplier})
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pi.quantity} × ৳{pi.unitPrice || pi.unit_price}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-blue-600 text-sm">
                        ৳{pi.totalAmount || pi.total_amount}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Grand Total
              </span>
              <span className="text-lg font-extrabold text-gray-900 font-mono">
                ৳
                {selectedPurchaseForDetails.total_amount ||
                  selectedPurchaseForDetails.totalAmount}
              </span>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPurchaseForDetails(null)}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}