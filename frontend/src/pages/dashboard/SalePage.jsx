import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/products`;

export default function SalePage() {
    // -------------------------------------------------------------
    // ১. সমস্ত স্টেটস (States) একসাথে সবার উপরে
    // -------------------------------------------------------------
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customer, setCustomer] = useState('Walk-in Customer');
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [receivedAmount, setReceivedAmount] = useState('');

    // -------------------------------------------------------------
    // ২. সাইড-ইফেক্ট (useEffect)
    // -------------------------------------------------------------
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');

                const response = await axios.get(API_URL, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                setProducts(response.data);
            } catch (err) {
                console.error("Error fetching products:", err);
                setError(err.response?.data?.message || "প্রোডাক্ট লোড করতে সমস্যা হয়েছে।");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // -------------------------------------------------------------
    // ৩. হিসাব-নিকাশ (Calculations)
    // -------------------------------------------------------------
    const subTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const payableAmount = Math.max(0, subTotal - Number(discount));
    const changeAmount = receivedAmount ? Math.max(0, Number(receivedAmount) - payableAmount) : 0;

    // -------------------------------------------------------------
    // ৪. ইভেন্ট হ্যান্ডলার ও লজিক ফাংশনসমূহ
    // -------------------------------------------------------------
    const addToCart = (product) => {
        const existingItem = cart.find(item => item.id === product.id);

        if (existingItem) {
            updateQuantity(product.id, 1);
        } else {
            setCart([...cart, { ...product, price: product.sellingPrice, quantity: 1 }]);
        }
        setSearchQuery('');
        setShowResults(false);
    };

    const updateQuantity = (id, change) => {
        setCart(prevCart =>
            prevCart.map(item => {
                if (item.id === id) {
                    const newQty = item.quantity + change;
                    return newQty > 0 ? { ...item, quantity: newQty } : item;
                }
                return item;
            })
        );
    };

    const removeFromCart = (id) => {
        setCart(prevCart => prevCart.filter(item => item.id !== id));
    };

    const handleCheckout = async (e) => {
        e.preventDefault();

        if (cart.length === 0) {
            alert("❌ কার্ট সম্পূর্ণ খালি! আগে প্রোডাক্ট যোগ করুন।");
            return;
        }

        const currentShopId = localStorage.getItem('shopId') || JSON.parse(localStorage.getItem('user') || '{}')?.shopId;

        if (!currentShopId) {
            alert("❌ শপ আইডি পাওয়া যায়নি! অনুগ্রহ করে আবার লগইন করুন।");
            return;
        }

        const orderData = {
            shopId: Number(currentShopId),
            customerId: null,
            customerName: customer,
            items: cart.map(item => ({
                productId: item.id || item.productId,
                name: item.name,
                sku: item.sku || '',
                price: item.price,
                purchasePrice: item.purchasePrice || 0,
                quantity: item.quantity,
                discount: 0
            })),
            subTotal: subTotal,
            discountType: 'FIXED',
            discountValue: Number(discount) || 0,
            discountAmount: Number(discount) || 0,
            vatPercentage: 0,
            vatAmount: 0,
            payableAmount: payableAmount,
            receivedAmount: receivedAmount ? Number(receivedAmount) : payableAmount,
            changeAmount: changeAmount,
            paymentMethod: paymentMethod,
            paymentStatus: Number(receivedAmount) >= payableAmount ? 'PAID' : (Number(receivedAmount) > 0 ? 'PARTIAL' : 'DUE'),
            notes: ''
        };

        try {
            const token = localStorage.getItem('token');

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/sales`, orderData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            alert(`🎉 বিল ও সেল সফলভাবে সেভ হয়েছে!\nইনভয়েস আইডি: ${response.data.invoiceNo || 'N/A'}\nসর্বমোট: ৳${payableAmount}`);

            setCart([]);
            setDiscount(0);
            setReceivedAmount('');
            setCustomer('Walk-in Customer');

        } catch (err) {
            console.error("Checkout error:", err);
            alert(err.response?.data?.message || "❌ সেল প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        }
    };

    // -------------------------------------------------------------
    // ৫. JSX রেন্ডারিং (সবকিছু এখন ফাংশনের ভেতরে)
    // -------------------------------------------------------------
    return (
        <div className="p-1 text-slate-900">
            {/* 📑 হেডার সেকশন */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Billing (POS)</h1>
                <p className="text-sm text-slate-500 mt-0.5">Create new invoices, manage cart, and process customer payments.</p>
            </div>

            {/* 🔄 মেইন লেআউট গ্রিড: টু-কলাম লেআউট */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 🛒 বাম পাশের কলাম: প্রোডাক্ট সার্চ ও কার্ট লিস্ট */}
                <div className="lg:col-span-2 space-y-5">

                    {/* সার্চ ও বারকোড ইনপুট বক্স */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search product by Name or Scan Barcode..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowResults(e.target.value.length > 0);
                                }}
                            />

                            {/* সার্চ ড্রপডাউন */}
                            {showResults && (
                                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {products
                                        .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((product) => (
                                            <div
                                                key={product.id}
                                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                                                onClick={() => {
                                                    addToCart(product);
                                                }}
                                            >
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{product.name}</p>
                                                    <p className="text-[10px] text-slate-400">{product.sku}</p>
                                                </div>
                                                <p className="text-sm font-bold text-slate-600">৳{product.sellingPrice}</p>
                                            </div>
                                        ))}

                                    {products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <div className="px-4 py-3 text-sm text-slate-400">No product found!</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                const foundProduct = products.find(p =>
                                    p.name.toLowerCase() === searchQuery.toLowerCase() ||
                                    p.sku.toLowerCase() === searchQuery.toLowerCase()
                                );
                                if (foundProduct) {
                                    addToCart(foundProduct);
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
                                            <th className="pb-3 font-semibold text-center">Quantity</th>
                                            <th className="pb-3 font-semibold text-right">Total</th>
                                            <th className="pb-3 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {cart.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4">
                                                    <div className="font-semibold text-slate-700">{item.name}</div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">{item.sku}</div>
                                                </td>
                                                <td className="py-4 text-center text-slate-600">৳{item.price}</td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right font-semibold text-slate-800">৳{item.price * item.quantity}</td>
                                                <td className="py-4 text-right">
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                                        title="Remove"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
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
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Details</label>
                            <div className="flex gap-2 mt-1.5">
                                <select
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                                    value={customer}
                                    onChange={(e) => setCustomer(e.target.value)}
                                >
                                    <option value="Walk-in Customer">👤 Walk-in Customer (খুচরা গ্রাহক)</option>
                                    <option value="Abdur Rahman">👤 Abdur Rahman</option>
                                    <option value="Sultana Razia">👤 Sultana Razia</option>
                                </select>
                                <button
                                    type="button"
                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-bold rounded-xl transition-colors"
                                    onClick={() => alert("নতুন কাস্টমার ক্রিয়েট মোডাল")}
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
                                <span className="font-semibold text-slate-700">৳{subTotal}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm text-slate-500">
                                <span>Discount (৳):</span>
                                <input
                                    type="number"
                                    className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm focus:outline-none"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                />
                            </div>

                            <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                                <span className="text-base font-bold text-slate-800">Total Payable:</span>
                                <span className="text-2xl font-black text-slate-900">৳{payableAmount}</span>
                            </div>
                        </div>
                    </div>

                    {/* পেমেন্ট সেকশন কার্ড */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Method</label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {['CASH', 'BKASH', 'CARD'].map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${paymentMethod === method
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        {method === 'CASH' ? '💵 Cash' : method === 'BKASH' ? '📱 bKash' : '💳 Card'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ক্যাশ কাউন্টার ইনপুট */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-400 uppercase">Received Cash</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none"
                                    value={receivedAmount}
                                    onChange={(e) => setReceivedAmount(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-400 uppercase">Change Back</label>
                                <div className="w-full mt-1 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 font-extrabold text-sm rounded-xl flex items-center h-[38px]">
                                    ৳{changeAmount}
                                </div>
                            </div>
                        </div>

                        {/* ফাইনাল চেকআউট বাটন */}
                        <button
                            onClick={handleCheckout}
                            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-all text-center flex items-center justify-center gap-2"
                        >
                            ✅ Proceed to Invoice & Print
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}