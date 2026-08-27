import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = `${import.meta.env.VITE_API_URL}/products`;

export default function SalePage() {
  const navigate = useNavigate();
  // -------------------------------------------------------------
  // ১. সমস্ত স্টেটস (States) একসাথে সবার উপরে
  // -------------------------------------------------------------
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // কাস্টমার রিলেটেড স্টেট
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // ➕ নতুন কাস্টমার যোগ করার পপআপ স্টেট (আগে /add_customer পেজে যেত)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // প্যাক সিলেকশন পপআপ স্টেট
  const [showPackModal, setShowPackModal] = useState(false);
  const [selectedProductForPack, setSelectedProductForPack] = useState(null);
  const [productPacks, setProductPacks] = useState([]);
  // ✅ null হলে নতুন আইটেম যোগ হচ্ছে, cartItemId থাকলে ঐ cart item-এর pack বদলানো হচ্ছে
  const [editingPackCartItemId, setEditingPackCartItemId] = useState(null);

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("FIXED");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentShopId = JSON.parse(
    localStorage.getItem("user") || "{}",
  )?.shopId;

  // -------------------------------------------------------------
  // ২. সাইড-ইফেক্ট (useEffect) - প্রোডাক্ট ও কাস্টমার লোড করা
  // -------------------------------------------------------------
  useEffect(() => {
    if (currentShopId) {
      fetchInitialData();
    }
  }, [currentShopId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [productsRes, customersRes] = await Promise.all([
        axios.get(API_URL, { headers }),
        axios
          .get(
            `${import.meta.env.VITE_API_URL}/add_customer?shopId=${currentShopId}`,
            { headers },
          )
          .catch(() => ({ data: [] })),
      ]);

      setProducts(productsRes.data);
      setCustomers(customersRes.data || []);
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError(err.response?.data?.message || "ডেটা লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ৩. হিসাব-নিকাশ (Calculations)
  // -------------------------------------------------------------
  const subTotal = cart.reduce((acc, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 0;
    return acc + itemPrice * itemQty;
  }, 0);

  const numericDiscountInput = Number(discount) || 0;
  const calculatedDiscountAmount =
    discountType === "PERCENTAGE"
      ? (subTotal * numericDiscountInput) / 100
      : numericDiscountInput;

  const payableAmount = Math.max(0, subTotal - calculatedDiscountAmount);
  const changeAmount = receivedAmount
    ? Math.max(0, Number(receivedAmount) - payableAmount)
    : 0;

  // -------------------------------------------------------------
  // ৪. ইভেন্ট হ্যান্ডলার ও স্টক লজিক ফাংশনসমূহ
  // -------------------------------------------------------------

  // ✅ ব্যাকএন্ড থেকে packs অ্যারে যে নামেই আসুক (product_packs / packs / productPacks), সঠিকভাবে বের করা
  const getProductPacks = (product) =>
    product.product_packs || product.packs || product.productPacks || [];

  const handleProductSelect = (product) => {
    const currentStock = Number(product.quantity) || 0;

    if (currentStock <= 0) {
      alert("❌ দুঃখিত! এই প্রোডাক্টটির স্টক শেষ (Stock Out)।");
      return;
    }

    // ✅ ব্যাকএন্ডে field নাম/কেসিং আলাদা হতে পারে, তাই একাধিক variant চেক করা হচ্ছে
    const packsArray = getProductPacks(product);
    const invType = (
      product.inventory_type ||
      product.inventoryType ||
      ""
    )
      .toString()
      .toLowerCase();

    // যদি প্রোডাক্টটি প্যাক টাইপের হয়, তবে প্যাকগুলো পপআপে দেখাবো
    if (invType === "pack" && packsArray.length > 0) {
      setEditingPackCartItemId(null); // নতুন আইটেম যোগ করা হচ্ছে
      setSelectedProductForPack(product);
      setProductPacks(packsArray);
      setShowPackModal(true);
      setShowResults(false);
      setSearchQuery("");
      return;
    }
    // সাধারণ প্রোডাক্টের ক্ষেত্রে সরাসরি কার্টে যোগ হবে
    addToCartDirectly(product, null, 1);
  };

  const addToCartDirectly = (product, packInfo = null, qtyToAdd = 1) => {
    const productId = product.id || product.productId;
    // ইউনিক কার্ট আইডি তৈরি (যদি প্যাক হয় তবে প্যাক আইডি সহ আলাদা আইটেম হিসেবে গণ্য হবে)
    const cartItemId = packInfo
      ? `${productId}-pack-${packInfo.id ?? packInfo.packId}`
      : `${productId}-single`;

    // ✅ স্ট্যান্ডার্ড ফিল্ড রিডিং - সব জায়গায় একই fallback অর্ডার
    const itemPrice = packInfo
      ? Number(packInfo.sellingPrice ?? packInfo.price ?? 0)
      : Number(product.sellingPrice || product.price);
    const itemName = packInfo
      ? `${product.name} (${packInfo.packName || packInfo.name || "Pack"})`
      : product.name;
    const itemMultiplier = packInfo
      ? Number(packInfo.multiplier ?? packInfo.quantity ?? 1)
      : 1;

    // ✅ প্যাক হলে প্যাকের নিজস্ব স্টক চেক হবে, না হলে মূল প্রোডাক্টের স্টক
    const availableStock = packInfo
      ? Number(packInfo.stock ?? 0)
      : Number(product.quantity) || 0;

    const existingItem = cart.find((item) => item.cartItemId === cartItemId);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;

    const neededQty = currentQuantityInCart + qtyToAdd;
    if (neededQty > availableStock) {
      alert(`❌ এর বেশি স্টক নেই! (সর্বোচ্চ মজুদ: ${availableStock}টি)`);
      return;
    }

    if (existingItem) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          cartItemId,
          id: productId,
          name: itemName,
          price: itemPrice,
          quantity: qtyToAdd,
          stock: availableStock, // ✅ এখন সবসময় সঠিক স্টক (প্রোডাক্ট বা প্যাক অনুযায়ী)
          isPack: !!packInfo,
          inventory_type:
            product.inventory_type ||
            product.inventoryType ||
            (packInfo ? "pack" : "single"),
          packs: getProductPacks(product), // ✅ যেকোনো field নাম থেকে packs ঠিকভাবে বসবে
          packInfo: packInfo,
          multiplier: itemMultiplier,
          selectedPackId: packInfo ? (packInfo.id ?? packInfo.packId) : null,
        },
      ]);
    }
    setSearchQuery("");
    setShowResults(false);
    setShowPackModal(false);
  };

  // ✅ কার্টে থাকা একটা আইটেমের জন্য pack select/change করার modal খোলা
  const openPackModalForCartItem = (item) => {
    const packsArray =
      item.packs && item.packs.length > 0 ? item.packs : getProductPacks(item);
    if (!packsArray || packsArray.length === 0) {
      alert("এই প্রোডাক্টের জন্য কোনো প্যাক পাওয়া যায়নি!");
      return;
    }
    setEditingPackCartItemId(item.cartItemId);
    setSelectedProductForPack(item);
    setProductPacks(packsArray);
    setShowPackModal(true);
  };

  // ✅ modal থেকে বাছাই করা pack, ইতিমধ্যে কার্টে থাকা আইটেমের উপর বসানো (দাম/স্টক/টোটাল রিক্যালকুলেট হবে)
  const applyPackToCartItem = (cartItemId, pack) => {
    const packId = pack.id ?? pack.packId;
    const packName = pack.packName || pack.name || "Pack";
    const packPrice = Number(pack.sellingPrice ?? pack.price ?? 0);
    const packMultiplier = Number(pack.multiplier ?? pack.quantity ?? 1);
    const packStock = Number(pack.stock ?? 0);

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.cartItemId !== cartItemId) return item;

        const productId = item.id;
        const newCartItemId = `${productId}-pack-${packId}`;
        const baseName = item.name.split(" (")[0];

        return {
          ...item,
          cartItemId: newCartItemId,
          selectedPackId: packId,
          name: `${baseName} (${packName})`,
          price: packPrice,
          stock: packStock, // ✅ প্যাক অনুযায়ী স্টক আপডেট
          packInfo: pack,
          multiplier: packMultiplier,
          inventory_type: "pack",
          // নতুন প্যাকের স্টকের চেয়ে বেশি quantity থাকলে অ্যাডজাস্ট করা
          quantity:
            packStock > 0 ? Math.min(item.quantity, packStock) : item.quantity,
        };
      }),
    );

    setShowPackModal(false);
    setEditingPackCartItemId(null);
  };

  const updateQuantity = (cartItemId, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.cartItemId === cartItemId) {
          // ✅ item.stock এ ইতিমধ্যে সঠিক স্টক থাকে (প্রোডাক্ট বা প্যাক অনুযায়ী)
          const availableStock = Number(item.stock ?? 0);

          if (qty > availableStock) {
            alert(`❌ পর্যাপ্ত স্টক নেই! সর্বোচ্চ ${availableStock} টি যোগ করতে পারবেন।`);
            return item; // আগের অবস্থায় আটকে রাখবে
          }

          return {
            ...item,
            quantity: qty,
          };
        }
        return item;
      }),
    );
  };

  const removeFromCart = (cartItemId) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.cartItemId !== cartItemId),
    );
  };

  // -------------------------------------------------------------
  // ➕ নতুন কাস্টমার যোগ করার হ্যান্ডলার (পপআপ থেকে, পেজ রিলোড ছাড়াই)
  // -------------------------------------------------------------
  const handleNewCustomerChange = (e) => {
    setNewCustomer({ ...newCustomer, [e.target.name]: e.target.value });
  };

  const handleSaveNewCustomer = async (e) => {
    e.preventDefault();
    if (savingCustomer) return;

    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      alert("নাম এবং মোবাইল নাম্বার আবশ্যক!");
      return;
    }

    if (!currentShopId) {
      alert("শপ আইডি পাওয়া যায়নি, দয়া করে আবার লগইন করুন!");
      return;
    }

    try {
      setSavingCustomer(true);
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/add_customer`,
        {
          ...newCustomer,
          shopId: Number(currentShopId),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // ব্যাকএন্ড যেভাবেই সেভ করা কাস্টমার অবজেক্ট রিটার্ন করুক (data / customer / সরাসরি)
      const savedCustomer =
        response.data?.customer || response.data?.data || response.data;

      const customerToAdd =
        savedCustomer && (savedCustomer.id || savedCustomer.customerId)
          ? savedCustomer
          : { ...newCustomer, id: Date.now() }; // ফলব্যাক, যদি ব্যাকএন্ড অবজেক্ট না দেয়

      // ✅ কাস্টমার লিস্টে সরাসরি যোগ করা হলো - পেজ রিলোড ছাড়াই তালিকায় থাকবে
      setCustomers((prev) => [customerToAdd, ...prev]);

      // এই নতুন কাস্টমারকেই বিক্রয়ের জন্য সিলেক্ট করে দেওয়া হলো
      setSelectedCustomer(customerToAdd);
      setCustomerSearch(customerToAdd.name);

      // ফর্ম রিসেট ও মোডাল বন্ধ
      setNewCustomer({ name: "", phone: "", email: "", address: "" });
      setShowAddCustomerModal(false);
      setShowCustomerDropdown(false);
    } catch (err) {
      console.error("Error saving customer:", err);
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "কাস্টমার সেভ করতে সমস্যা হয়েছে!",
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (cart.length === 0) {
      alert("❌ কার্ট সম্পূর্ণ খালি! আগে প্রোডাক্ট যোগ করুন।");
      return;
    }

    // ✅ প্যাক-টাইপ আইটেমের জন্য pack সিলেক্ট করা বাধ্যতামূলক
    const missingPackItem = cart.find(
      (item) =>
        (item.inventory_type === "pack" ||
          (item.packs && item.packs.length > 0)) &&
        !item.selectedPackId,
    );
    if (missingPackItem) {
      alert(`❌ "${missingPackItem.name}" এর জন্য প্যাক সিলেক্ট করুন আগে।`);
      return;
    }

    if (!currentShopId) {
      alert("❌ শপ আইডি পাওয়া যায়নি! অনুগ্রহ করে আবার লগইন করুন।");
      return;
    }

    // Received Amount payable amount-এর চেয়ে কম হলে
    // Customer information অবশ্যই থাকতে হবে
    if (
      Number(receivedAmount || 0) < payableAmount ||
      Number(receivedAmount || 0) === 0
    ) {
      if (!selectedCustomer) {
        alert(
          "❌ প্রাপ্ত অর্থ মোট প্রদেয়ের চেয়ে কম। অনুগ্রহ করে গ্রাহকের তথ্য যোগ করুন।"
        );
        return;
      }
    }

    const orderData = {
      shopId: Number(currentShopId),

      customerId: selectedCustomer
        ? selectedCustomer.id || selectedCustomer.customerId
        : null,

      customerName: customerSearch || "Walk-in Customer",

      items: cart.map((item) => {
        const isPackItem = Boolean(item.packInfo || item.selectedPackId);

        const itemPurchasePrice =
          isPackItem && item.packInfo?.purchasePrice
            ? Number(item.packInfo.purchasePrice)
            : Number(item.purchasePrice || 0);

        return {
          productId: item.id || item.productId,
          name: item.name,
          sku: item.sku || "",
          price: Number(item.price),
          purchasePrice: itemPurchasePrice,
          quantity: Number(item.quantity),
          multiplier: Number(item.multiplier || 1),
          isPack: isPackItem,
          packId: item.selectedPackId || null,
          packInfo: item.packInfo || null,
          discount: 0,
        };
      }),

      subTotal: Number(subTotal),

      discountType: discountType,

      discountValue: Number(discount) || 0,

      discountAmount: Number(calculatedDiscountAmount) || 0,

      vatPercentage: 0,

      vatAmount: 0,

      payableAmount: Number(payableAmount),

      // Received Amount খালি থাকলে 0 যাবে
      receivedAmount: receivedAmount
        ? Number(receivedAmount)
        : 0,

      changeAmount: Number(changeAmount || 0),

      paymentMethod: paymentMethod,

      paymentStatus:
        Number(receivedAmount) >= payableAmount && payableAmount > 0
          ? "PAID"
          : Number(receivedAmount) > 0
            ? "PARTIAL"
            : "DUE",

      notes: "",
    };

    try {
      setIsSubmitting(true);

      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/sales`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        alert(
          `🎉 বিল ও সেল সফলভাবে সেভ হয়েছে!\nইনভয়েস আইডি: ${response.data.invoiceNo || "N/A"
          }\nসর্বমোট: ৳${payableAmount}`
        );

        setCart([]);
        setDiscount(0);
        setReceivedAmount("");
        setSelectedCustomer(null);
        setCustomerSearch("");

        fetchInitialData();
      }
    } catch (error) {
      console.error("Checkout Error:", error);

      alert(
        error.response?.data?.message ||
        "❌ সেল প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // ৫. JSX রেন্ডারিং
  // -------------------------------------------------------------
  return (
    <div className="p-1 text-slate-900 relative">
      {/* 📦 প্যাক সিলেকশন পপআপ মোডাল */}
      {showPackModal && selectedProductForPack && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              প্যাক সিলেক্ট করুন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              <span className="font-semibold text-slate-700">
                {selectedProductForPack.name}
              </span>{" "}
              এর জন্য কোন প্যাকেজিং অপশনে বিক্রি করবেন, তা বেছে নিন
            </p>

            <div className="space-y-2.5 max-h-60 overflow-y-auto mb-5">
              {productPacks.map((pack) => {
                // ✅ স্ট্যান্ডার্ড ফিল্ড রিডিং - সব ফিল্ডে fallback
                const packId = pack.id ?? pack.packId;
                const packName = pack.packName || pack.name || "Pack";
                const packPrice = Number(pack.sellingPrice ?? pack.price ?? 0);
                const packMultiplier = Number(
                  pack.multiplier ?? pack.quantity ?? 1,
                );
                const packStock = Number(pack.stock ?? 0);
                const isOut = packStock <= 0;

                return (
                  <div
                    key={packId}
                    onClick={() => {
                      if (isOut) {
                        alert(`❌ "${packName}" প্যাকের স্টক শেষ!`);
                        return;
                      }
                      if (editingPackCartItemId) {
                        // ✅ ইতিমধ্যে কার্টে থাকা আইটেমের pack বদলানো হচ্ছে
                        applyPackToCartItem(editingPackCartItemId, pack);
                      } else {
                        // নতুন আইটেম কার্টে যোগ হচ্ছে
                        addToCartDirectly(selectedProductForPack, pack, 1);
                      }
                    }}
                    className={`p-3.5 border rounded-xl transition-all flex justify-between items-center group ${
                      isOut
                        ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                        : "bg-slate-50 hover:bg-slate-900 hover:text-white border-slate-200 cursor-pointer"
                    }`}
                  >
                    <div>
                      <p
                        className={`font-bold text-sm text-slate-800 ${
                          !isOut && "group-hover:text-white"
                        }`}
                      >
                        {packName}
                        {isOut && (
                          <span className="ml-2 text-red-500 text-[10px] font-bold">
                            (Stock Out)
                          </span>
                        )}
                      </p>
                      <p
                        className={`text-xs text-slate-400 mt-0.5 ${
                          !isOut && "group-hover:text-slate-300"
                        }`}
                      >
                        প্রতি প্যাকে: {packMultiplier} ইউনিট &nbsp;|&nbsp; স্টক:{" "}
                        {packStock}
                      </p>
                    </div>
                    <p
                      className={`font-extrabold text-slate-900 text-base ${
                        !isOut && "group-hover:text-emerald-400"
                      }`}
                    >
                      ৳{packPrice}
                    </p>
                  </div>
                );
              })}

              {productPacks.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400">
                  কোনো প্যাক পাওয়া যায়নি
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPackModal(false);
                  setEditingPackCartItemId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👤➕ নতুন কাস্টমার যোগ করার পপআপ মোডাল (আগে যেখানে /add_customer পেজে navigate করতো) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  নতুন কাস্টমার যোগ করুন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  তথ্য দিয়ে সেভ করুন, সাথে সাথে লিস্টে যুক্ত হয়ে যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  কাস্টমারের নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={newCustomer.name}
                  onChange={handleNewCustomerChange}
                  placeholder="যেমন: আব্দুর রহিম"
                  required
                  className="w-full px-3.5 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  মোবাইল নাম্বার <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={newCustomer.phone}
                  onChange={handleNewCustomerChange}
                  placeholder="যেমন: 01712345678"
                  required
                  className="w-full px-3.5 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ইমেইল (যদি থাকে)
                </label>
                <input
                  type="email"
                  name="email"
                  value={newCustomer.email}
                  onChange={handleNewCustomerChange}
                  placeholder="example@gmail.com"
                  className="w-full px-3.5 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ঠিকানা
                </label>
                <textarea
                  name="address"
                  rows="2"
                  value={newCustomer.address}
                  onChange={handleNewCustomerChange}
                  placeholder="গ্রাম/মহল্লা, থানা, জেলা"
                  className="w-full px-3.5 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none text-sm"
                ></textarea>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {savingCustomer ? "সেভ হচ্ছে..." : "সেভ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📑 হেডার সেকশন */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sales & Billing (POS)
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create new invoices, manage cart, and process customer payments.
        </p>
      </div>

      {loading && (
        <div className="text-center py-4 text-sm text-slate-400">
          ⏳ ডেটা লোড হচ্ছে...
        </div>
      )}
      {error && (
        <div className="text-center py-2 text-sm text-red-500 bg-red-50 rounded-lg mb-3">
          {error}
        </div>
      )}

      {/* 🔄 মেইন লেআউট গ্রিড: টু-কলাম লেআউট */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 🛒 বাম পাশের কলাম: প্রোডাক্ট সার্চ ও কার্ট লিস্ট */}
        <div className="lg:col-span-2 space-y-5">
          {/* সার্চ ও বারকোড ইনপুট বক্স */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search product by Name or Scan Barcode..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(e.target.value.length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const foundProduct = products.find(
                      (p) =>
                        p.name.toLowerCase() === searchQuery.toLowerCase() ||
                        (p.sku &&
                          p.sku.toLowerCase() === searchQuery.toLowerCase()),
                    );
                    if (foundProduct) {
                      handleProductSelect(foundProduct);
                    } else {
                      alert("প্রোডাক্টটি খুঁজে পাওয়া যায়নি!");
                    }
                  }
                }}
              />

              {/* সার্চ ড্রপডাউন */}
              {showResults && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {products
                    .filter(
                      (p) =>
                        p.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        (p.sku &&
                          p.sku
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())),
                    )
                    .map((product) => {
                      const stock = Number(product.quantity) || 0;
                      const isOutOfStock = stock <= 0;

                      return (
                        <div
                          key={product.id || product.productId}
                          className={`px-4 py-3 border-b border-slate-50 last:border-0 flex justify-between items-center ${isOutOfStock
                            ? "bg-slate-100 opacity-60 cursor-not-allowed"
                            : "hover:bg-slate-50 cursor-pointer"
                            }`}
                          onClick={() => {
                            if (isOutOfStock) {
                              alert("❌ এই প্রোডাক্টটির স্টক শেষ!");
                              return;
                            }
                            handleProductSelect(product);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {product.name}{" "}
                              {isOutOfStock && (
                                <span className="text-red-500 text-xs font-bold">
                                  (Stock Out)
                                </span>
                              )}
                              {product.inventory_type === "pack" && (
                                <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
                                  Pack Available
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              SKU: {product.sku || "N/A"} | Stock: {stock}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-slate-600">
                            ৳{product.sellingPrice || product.price}
                          </p>
                        </div>
                      );
                    })}

                  {products.filter(
                    (p) =>
                      p.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      (p.sku &&
                        p.sku
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase())),
                  ).length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        No product found!
                      </div>
                    )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const foundProduct = products.find(
                  (p) =>
                    p.name.toLowerCase() === searchQuery.toLowerCase() ||
                    (p.sku &&
                      p.sku.toLowerCase() === searchQuery.toLowerCase()),
                );
                if (foundProduct) {
                  handleProductSelect(foundProduct);
                } else {
                  alert("প্রোডাক্টটি খুঁজে পাওয়া যায়নি!");
                }
              }}
              className="px-4 py-2.5 bg-slate-900 text-white font-medium text-sm rounded-xl hover:bg-slate-800 transition-colors"
            >
              Add Item
            </button>
          </div>

          {/* কার্ট টেবিল কার্ড */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              🛒 Current Order Cart ({cart.length})
            </h3>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No products added to cart yet. Start scanning or searching!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-3 font-semibold">Product Details</th>
                      <th className="pb-3 font-semibold text-center">
                        Price
                      </th>
                      <th className="pb-3 font-semibold text-center">
                        Quantity
                      </th>
                      <th className="pb-3 font-semibold text-right">Total</th>
                      <th className="pb-3 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cart.map((item) => {
                      const cartItemId = item.cartItemId;

                      return (
                        <tr
                          key={cartItemId}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800 text-sm">
                              {item.name}
                            </div>

                            {(() => {
                              const hasPacks =
                                item.inventory_type === "pack" ||
                                (item.packs && item.packs.length > 0);

                              // সাধারণ (non-pack) প্রোডাক্ট — শুধু SKU/Stock দেখাবে
                              if (!hasPacks) {
                                return (
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    SKU: {item.sku || "N/A"} | Stock: {item.stock}
                                  </div>
                                );
                              }

                              // প্যাক প্রোডাক্ট, কিন্তু এখনো কোনো প্যাক সিলেক্ট করা হয়নি
                              if (!item.selectedPackId) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openPackModalForCartItem(item)
                                    }
                                    className="mt-1 px-2 py-0.5 text-[11px] font-semibold text-red-600 border border-red-400 rounded-md hover:bg-red-50 transition-colors"
                                  >
                                    Select Pack
                                  </button>
                                );
                              }

                              // প্যাক সিলেক্ট করা আছে — স্টক দেখাবে + Change Pack অপশন
                              return (
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                  <span>Stock: {item.stock}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openPackModalForCartItem(item)
                                    }
                                    className="text-indigo-600 font-semibold hover:underline"
                                  >
                                    Change Pack
                                  </button>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-4 text-center text-slate-600">
                            ৳{item.price}
                          </td>

                          <td className="py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    cartItemId,
                                    item.quantity - 1,
                                  )
                                }
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                              >
                                -
                              </button>

                              {/* ডাইরেক্ট ইনপুট বক্স */}
                              <input
                                type="number"
                                min="1"
                                className="w-12 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateQuantity(cartItemId, e.target.value)
                                }
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    cartItemId,
                                    item.quantity + 1,
                                  )
                                }
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-4 text-right font-semibold text-slate-800">
                            ৳{item.price * item.quantity}
                          </td>

                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeFromCart(cartItemId)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                              title="Remove"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 💳 ডান পাশের কলাম: কাস্টমার সিলেকশন ও বিল সামারি */}
        <div className="space-y-5">
          {/* কাস্টমার ও বিল ইনফো */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="relative">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Customer Details
              </label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by name or mobile..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) {
                        setSelectedCustomer(null);
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                  />

                  {/* ডাইনামিক কাস্টমার ড্রপডাউন */}
                  {showCustomerDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-700 font-medium border-b border-slate-50"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearch("Walk-in Customer");
                          setShowCustomerDropdown(false);
                        }}
                      >
                        👤 Walk-in Customer (খুচরা গ্রাহক)
                      </div>
                      {customers
                        .filter(
                          (c) =>
                            (c.name &&
                              c.name
                                .toLowerCase()
                                .includes(customerSearch.toLowerCase())) ||
                            (c.phone && c.phone.includes(customerSearch)) ||
                            (c.mobile && c.mobile.includes(customerSearch)),
                        )
                        .map((cust) => (
                          <div
                            key={cust.id || cust.customerId}
                            className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerSearch(cust.name);
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <p className="font-medium text-slate-800">
                              {cust.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              📞 {cust.phone || cust.mobile || "N/A"}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-bold rounded-xl transition-colors"
                  onClick={() => {
                    setShowCustomerDropdown(false);
                    setShowAddCustomerModal(true);
                  }}
                >
                  ➕
                </button>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* বিল সামারি ডিসপ্লে */}
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Sub Total:</span>
                <span className="font-semibold text-slate-700">
                  ৳{subTotal}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 py-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm text-slate-500">
                  <span>Discount:</span>
                  <div className="flex items-center gap-1.5">
                    {/* ডিসকাউন্ট ইনপুট বক্স */}
                    <input
                      type="number"
                      placeholder="0"
                      className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm focus:outline-none focus:border-indigo-500"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                    {/* টাকা নাকি পার্সেন্টেজ ড্রপডাউন */}
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="FIXED">৳ (Fixed)</option>
                      <option value="PERCENTAGE">% (Percent)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-base font-bold text-slate-800">
                  Total Payable:
                </span>
                <span className="text-2xl font-black text-slate-900">
                  ৳{payableAmount}
                </span>
              </div>
            </div>
          </div>

          {/* পেমেন্ট সেকশন কার্ড */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {["CASH", "BKASH", "CARD"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${paymentMethod === method
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                  >
                    {method === "CASH"
                      ? "💵 Cash"
                      : method === "BKASH"
                        ? "📱 bKash"
                        : "💳 Card"}
                  </button>
                ))}
              </div>
            </div>

            {/* ক্যাশ কাউন্টার ইনপুট */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase">
                  Received Cash
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase">
                  Change Back
                </label>
                <div className="w-full mt-1 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 font-extrabold text-sm rounded-xl flex items-center h-[38px]">
                  ৳{changeAmount}
                </div>
              </div>
            </div>

            {/* ফাইনাল চেকআউট বাটন */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className={`w-full mt-2 py-3 font-bold rounded-xl shadow-md transition-all text-center flex items-center justify-center gap-2 text-white ${isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500"
                }`}
            >
              {isSubmitting
                ? "⏳ প্রসেসিং হচ্ছে..."
                : "✅ Proceed to Invoice & Print"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}