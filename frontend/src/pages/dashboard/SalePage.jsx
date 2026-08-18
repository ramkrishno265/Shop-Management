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

  // প্যাক সিলেকশন পপআপ স্টেট
  const [showPackModal, setShowPackModal] = useState(false);
  const [selectedProductForPack, setSelectedProductForPack] = useState(null);
  const [productPacks, setProductPacks] = useState([]);

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("FIXED");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receivedAmount, setReceivedAmount] = useState("");

  const currentShopId = JSON.parse(
    localStorage.getItem("user") || "{}",
  )?.shopId;

  // -------------------------------------------------------------
  // ২. সাইড-ইফেক্ট (useEffect) - প্রোডাক্ট ও কাস্টমার লোড করা
  // -------------------------------------------------------------
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
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

    if (currentShopId) {
      fetchInitialData();
    }
  }, [currentShopId]);

  // -------------------------------------------------------------
  // ৩. হিসাব-নিকাশ (Calculations)
  // -------------------------------------------------------------
  const subTotal = cart.reduce((acc, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 0;
    return acc + (itemPrice * itemQty);
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
  const handleProductSelect = (product) => {
    const currentStock = Number(product.quantity) || 0;

    if (currentStock <= 0) {
      alert("❌ দুঃখিত! এই প্রোডাক্টটির স্টক শেষ (Stock Out)।");
      return;
    }

    // যদি প্রোডাক্টটি প্যাক টাইপের হয়, তবে প্যাকগুলো পপআপে দেখাবো
    if (
      product.inventory_type === "pack" &&
      product.product_packs &&
      product.product_packs.length > 0
    ) {
      setSelectedProductForPack(product);
      setProductPacks(product.product_packs);
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
    // ইউনিক কার্ট আইডি তৈরি (যদি প্যাক হয় তবে প্যাক আইডি সহ আলাদা আইটেম হিসেবে গণ্য হবে)
    const cartItemId = packInfo
      ? `${productId}-pack-${packInfo.id || packInfo.packId}`
      : `${productId}-single`;

    const currentStock = Number(product.quantity) || 0;
    const itemPrice = packInfo
      ? Number(packInfo.price)
      : Number(product.sellingPrice || product.price);
    const itemName = packInfo
      ? `${product.name} (${packInfo.name || packInfo.packName || "Pack"})`
      : product.name;
    const itemMultiplier = packInfo
      ? Number(packInfo.multiplier || packInfo.quantity || 1)
      : 1;

    // মোট প্রয়োজনীয় স্টক চেক (যদি প্যাক হয় তবে প্যাকের ইউনিট অনুযায়ী মোট স্টক কাটবে)
    const totalRequiredStock = qtyToAdd * itemMultiplier;

    const existingItem = cart.find((item) => item.cartItemId === cartItemId);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;

    if ((currentQuantityInCart + qtyToAdd) * itemMultiplier > currentStock) {
      alert(`❌ এর বেশি স্টক নেই! (সর্বোচ্চ মজুদ: ${currentStock}টি একক)`);
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
          stock: currentStock,
          isPack: !!packInfo,
          inventory_type:
            product.inventory_type || (packInfo ? "pack" : "single"), // এটি যোগ করুন
          packInfo: packInfo,
          multiplier: itemMultiplier,
          selectedPackId: packInfo ? packInfo.id || packInfo.packId : null, // সিলেক্টেড প্যাক আইডি সেট করা
        },
      ]);
    }
    setSearchQuery("");
    setShowResults(false);
    setShowPackModal(false);
  };


  const updateItemPack = (cartItemId, newPackId) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.cartItemId === cartItemId) {
          // 'packs' অ্যারে থেকে সিলেক্ট করা প্যাকটি খোঁজা
          const selectedPack = item.packs?.find(
            (p) => String(p.id) === String(newPackId)
          );

          if (!selectedPack) return item;

          const productId = item.id;
          const newCartItemId = `${productId}-pack-${selectedPack.id}`;
          const itemMultiplier = Number(selectedPack.multiplier || 1);
          const currentStock = Number(item.quantity) || 0; // মোট স্টক

          return {
            ...item,
            cartItemId: newCartItemId,
            selectedPackId: selectedPack.id,
            name: `${item.name.split(" (")[0]} (${selectedPack.packName})`,
            price: Number(selectedPack.sellingPrice || item.price), // প্যাকের নিজস্ব দাম থাকলে তা বা ডিফল্ট দাম
            packInfo: selectedPack,
            multiplier: itemMultiplier,
          };
        }
        return item;
      })
    );
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
          // প্যাক সিলেক্ট করা থাকলে প্যাকের নিজস্ব স্টক, না থাকলে মেইন প্রডাক্টের স্টক
          const maxStock = Number(item.packInfo?.stock ?? item.stock ?? 100);

          // সরাসরি কার্টের কোয়ান্টিটি (প্যাকের ক্ষেত্রে প্রতিটি প্যাক ১টি করে আইটেম হিসেবে বাড়লে অথবা মোট প্যাকের সংখ্যা স্টক পার হলে)
          if (qty > maxStock) {
            alert(`❌ পর্যাপ্ত স্টক নেই! এই প্যাকে সর্বোচ্চ মজুদ আছে: ${maxStock} টি`);
            return item; // আগের অবস্থায় আটকে রাখবে
          }

          return {
            ...item,
            quantity: qty,
          };
        }
        return item;
      })
    );
  };
  const removeFromCart = (cartItemId) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.cartItemId !== cartItemId),
    );
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (cart.length === 0) {
      alert("❌ কার্ট সম্পূর্ণ খালি! আগে প্রোডাক্ট যোগ করুন।");
      return;
    }

    if (!currentShopId) {
      alert("❌ শপ আইডি পাওয়া যায়নি! অনুগ্রহ করে আবার লগইন করুন।");
      return;
    }

    try {
      setIsSubmitting(true);

      const saleData = {
        shopId: currentShopId,
        items: cart,
      };

      const response = await axios.post('/api/sales', saleData);

      if (response.data.success) {
        alert("✅ সফলভাবে অর্ডার সম্পন্ন হয়েছে!");
      }
    } catch (error) {
      console.error("Checkout Error:", error);
      alert(error.response?.data?.message || "অর্ডার প্রসেস করতে সমস্যা হয়েছে!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderData = {
    shopId: Number(currentShopId),
    customerId: selectedCustomer
      ? selectedCustomer.id || selectedCustomer.customerId
      : null,
    customerName: customerSearch || "Walk-in Customer",
    items: cart.map((item) => {
      const isPackItem = Boolean(item.packInfo || item.selectedPackId);
      const itemPurchasePrice = isPackItem && item.packInfo?.purchasePrice
        ? Number(item.packInfo.purchasePrice)
        : Number(item.purchasePrice || 0);

      return {
        productId: item.id || item.productId,
        name: item.name,
        sku: item.sku || "",
        price: Number(item.price),
        purchasePrice: itemPurchasePrice,
        quantity: Number(item.quantity),          // ✅ raw quantity, multiply নেই
        multiplier: Number(item.multiplier || 1),  // ✅ আলাদা করে পাঠান
        isPack: isPackItem,
        packId: item.selectedPackId || null,
        packInfo: item.packInfo || null,
        discount: 0,
      };
    }),
    subTotal: Number(subTotal),
    discountType: "FIXED",
    discountValue: Number(discount) || 0,
    discountAmount: Number(discount) || 0,
    vatPercentage: 0,
    vatAmount: 0,
    payableAmount: Number(payableAmount),
    receivedAmount: receivedAmount ? Number(receivedAmount) : Number(payableAmount),
    changeAmount: Number(changeAmount || 0),
    paymentMethod: paymentMethod,
    paymentStatus:
      Number(receivedAmount) >= payableAmount
        ? "PAID"
        : Number(receivedAmount) > 0
          ? "PARTIAL"
          : "DUE",
    notes: "",
  };

  try {
    const token = localStorage.getItem("token");

    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/sales`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    alert(
      `🎉 বিল ও সেল সফলভাবে সেভ হয়েছে!\nইনভয়েস আইডি: ${response.data.invoiceNo || "N/A"}\nসর্বমোট: ৳${payableAmount}`,
    );

    setCart([]);
    setDiscount(0);
    setReceivedAmount("");
    setSelectedCustomer(null);
    setCustomerSearch("Walk-in Customer");
  } catch (err) {
    console.error("Checkout error:", err);
    alert(
      err.response?.data?.message ||
      "❌ সেল প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    );
  }
};

// -------------------------------------------------------------
// ৫. JSX রেন্ডারিং
// -------------------------------------------------------------

console.log("PRODUCTS:", products);

return (
  <div className="p-1 text-slate-900 relative">
    {/* 📦 প্যাক সিলেকশন পপআপ মোডাল */}
    {showPackModal && selectedProductForPack && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            Select Pack Type
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Choose a packaging option for{" "}
            <span className="font-semibold text-slate-700">
              {selectedProductForPack.name}
            </span>
          </p>

          <div className="space-y-2.5 max-h-60 overflow-y-auto mb-5">
            {productPacks.map((pack, idx) => (
              <div
                key={idx}
                onClick={() =>
                  addToCartDirectly(selectedProductForPack, pack, 1)
                }
                className="p-3.5 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 rounded-xl cursor-pointer transition-all flex justify-between items-center group"
              >
                <div>
                  <p className="font-bold text-sm text-slate-800 group-hover:text-white">
                    {pack.name || pack.packName}
                  </p>
                  <p className="text-xs text-slate-400 group-hover:text-slate-300">
                    Contains: {pack.multiplier || pack.quantity} units
                  </p>
                </div>
                <p className="font-extrabold text-slate-900 group-hover:text-emerald-400 text-base">
                  ৳{pack.price}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPackModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
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
                    <th className="pb-3 font-semibold text-center">Price</th>
                    <th className="pb-3 font-semibold text-center">
                      Quantity
                    </th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map((item) => {
                    const cartItemId = item.cartItemId;
                    const isPack = item.inventory_type === "pack";

                    return (
                      <tr
                        key={cartItemId}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 text-sm">
                            {item.name}
                          </div>

                          {/* এই অংশটি আপনার কোডের SKU/Stock দেখানোর জায়গায় হুবহু বসিয়ে দিন */}
                          {/* কার্ট টেবিলের SKU/Stock দেখানোর জায়গায় এটি বসিয়ে দিন */}
                          {(() => {
                            const hasPacks =
                              item.inventoryType === "pack" ||
                              (item.packs && item.packs.length > 0);

                            return (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {hasPacks ? (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="font-medium text-slate-500">
                                      Pack:
                                    </span>
                                    <select
                                      value={item.selectedPackId || ""}
                                      onChange={(e) =>
                                        updateItemPack(
                                          item.cartItemId,
                                          e.target.value,
                                        )
                                      }
                                      className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="" disabled>
                                        Select Pack
                                      </option>
                                      {item.packs?.map((pack) => (
                                        <option key={pack.id} value={pack.id}>
                                          {pack.packName} (Qty:{" "}
                                          {pack.stock}, ৳
                                          {pack.sellingPrice || item.price})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <>
                                    SKU: {item.sku || "N/A"} | Stock:{" "}
                                    {item.quantity}
                                  </>
                                )}
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
                                updateQuantity(cartItemId, item.quantity - 1)
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
                                updateQuantity(cartItemId, item.quantity + 1)
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
                onClick={() => navigate("/add_customer")}
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
            className={`w-full mt-2 py-3 font-bold rounded-xl shadow-md transition-all text-center flex items-center justify-center gap-2 text-white ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
          >
            {isSubmitting ? '⏳ প্রসেসিং হচ্ছে...' : '✅ Proceed to Invoice & Print'}
          </button>
        </div>
      </div>
    </div>
  </div>
);
}
