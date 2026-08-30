import React, { useState, useEffect } from 'react';

export default function ExpiryManagement() {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

    // ✅ raw ISO string (2026-08-28T00:00:00.000Z) কে পরিষ্কার, রিডেবল ফরম্যাটে দেখানোর হেল্পার
    const formatDate = (dateValue) => {
        if (!dateValue) return "N/A";
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return "N/A";
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }); // যেমন: 28 Aug 2026
    };

    // ডেটা ফেচ করার ইফেক্ট
    useEffect(() => {
        fetchExpiryData();
    }, []);

    const fetchExpiryData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || '';
            const userStr = localStorage.getItem('user');

            let shopId = '';
            if (userStr) {
                try {
                    const userObj = JSON.parse(userStr);
                    shopId = userObj.shop_id || userObj.shopId || '';
                } catch (e) {
                    console.error("Error parsing user from localStorage", e);
                }
            }

            if (!shopId) {
                console.warn("Shop ID not found in localStore user!");
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_URL}/products`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Shop-Id': shopId
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch shop-specific expiry data');
            }

            const result = await response.json();
            const rawData = result.data || result;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const formattedData = rawData
                // যেসব প্রোডাক্টে আদৌ কোনো expiry date সেট করা নেই, সেগুলো শুরুতেই বাদ
                .filter((item) => item.expireDate || item.expiry_date || item.expiryDate)
                .map((item, index) => {
                    // ✅ Prisma model field এর নাম expireDate (camelCase) — কিন্তু পুরোনো ডেটা বা
                    // অন্য এন্ডপয়েন্ট থেকে expiry_date / expiryDate নামেও আসতে পারে, তাই সবগুলো fallback রাখা হলো
                    const rawExpiry = item.expireDate || item.expiry_date || item.expiryDate;
                    const expiry = new Date(rawExpiry);
                    expiry.setHours(0, 0, 0, 0);

                    const diffTime = expiry - today;
                    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let status = 'safe';
                    if (daysLeft < 0) {
                        status = 'expired';
                    } else if (daysLeft <= 7) {
                        status = 'critical';
                    } else if (daysLeft <= 30) {
                        status = 'expiring_soon';
                    }

                    return {
                        id: item.id || index + 1,
                        name: item.name || item.product_name,
                        sku: item.sku || 'N/A',
                        batchNo: item.batch_no || item.batch_number || 'N/A',
                        stock: item.quantity ?? item.stock ?? 0,
                        expiryDate: rawExpiry,
                        status: status,
                        daysLeft: daysLeft
                    };
                });

            setProducts(formattedData);
        } catch (error) {
            console.error("Error fetching expiry items from Neon Database:", error);
            alert("ডেটা লোড করতে সমস্যা হয়েছে: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ১. ফিল্টারিং: শুধু সেই আইটেমগুলো রাখা হচ্ছে যেগুলোর মেয়াদ আগামী ৩০ দিনের মধ্যে শেষ হবে
    // অথবা যেগুলোর মেয়াদ ইতিমধ্যেই পার হয়ে গেছে (daysLeft negative)
    const filteredProducts = products.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.batchNo.toLowerCase().includes(searchQuery.toLowerCase());

        const isExpiringOrExpired = item.daysLeft <= 30;

        return matchesSearch && isExpiringOrExpired;
    });

    // ২. সর্টিং: daysLeft অনুযায়ী Ascending — সবচেয়ে কম বাকি (বা মেয়াদোত্তীর্ণ, negative) থাকা পণ্য সবার উপরে
    const sortedProducts = [...filteredProducts].sort((a, b) => a.daysLeft - b.daysLeft);

    // পেজিনেশন লজিক (সর্ট করা ডেটার উপর ভিত্তি করে)
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = sortedProducts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

    // মোট কয়টি আইটেম ৩০ দিনের মধ্যে বা ডেট পার হওয়া আছে তার কাউন্ট (সার্চ ফিল্টার ছাড়াই, ব্যাজের জন্য)
    const criticalOrUpcomingCount = products.filter(p => p.daysLeft <= 30).length;

    return (
        <div className="mx-auto space-y-6">

            {/* পেজ হেডার — এখানেই স্পষ্ট করে বলা হচ্ছে এই পেজে কী দেখানো হচ্ছে */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        ⏳ Product Expiry Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        আগামী ৩০ দিনের মধ্যে মেয়াদ শেষ হবে অথবা ইতিমধ্যে মেয়াদোত্তীর্ণ — এমন পণ্যগুলো এখানে দেখানো হচ্ছে।
                    </p>
                </div>

                {/* সার্চ বার */}
                <div className="w-full md:w-72">
                    <input
                        type="text"
                        placeholder="Search by name, SKU, batch..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
                    />
                </div>
            </div>

            {/* স্ট্যাটাস হেডার — এই পেজে যে শুধুমাত্র ৩০ দিনের মধ্যে ঝুঁকিপূর্ণ/মেয়াদোত্তীর্ণ পণ্য দেখানো হচ্ছে, তা স্পষ্টভাবে বলা হলো */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <span className="text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3">
                    ঝুঁকিপূর্ণ / মেয়াদোত্তীর্ণ পণ্য ({criticalOrUpcomingCount})
                </span>
            </div>

            {/* টেবিল কার্ড */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Loading expiry inventory...</div>
                ) : currentItems.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">
                        🎉 চমৎকার! আগামী ৩০ দিনের মধ্যে মেয়াদ শেষ হওয়ার মতো কোনো পণ্য নেই।
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                                <tr>
                                    <th className="py-3.5 px-4">Product</th>
                                    <th className="py-3.5 px-4">Batch No</th>
                                    <th className="py-3.5 px-4 text-center">Stock</th>
                                    <th className="py-3.5 px-4 text-center">Expiry Date</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentItems.map((item) => {
                                    let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                    let dotColor = "bg-emerald-500";
                                    let statusText = `${item.daysLeft} days left`;

                                    if (item.daysLeft < 0) {
                                        badgeStyle = "bg-red-100 text-red-700 border-red-300 font-bold";
                                        dotColor = "bg-red-500";
                                        statusText = `Expired ${Math.abs(item.daysLeft)}d ago`;
                                    } else if (item.daysLeft <= 7) {
                                        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
                                        dotColor = "bg-rose-500 animate-pulse";
                                        statusText = `Critical — ${item.daysLeft}d left`;
                                    } else if (item.daysLeft <= 30) {
                                        badgeStyle = "bg-amber-50 text-amber-700 border-amber-200 font-medium";
                                        dotColor = "bg-amber-500";
                                        statusText = `Expiring — ${item.daysLeft}d left`;
                                    }

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`transition-colors ${
                                                item.daysLeft < 0
                                                    ? "bg-red-50 hover:bg-red-100/70 border-l-4 border-red-500"
                                                    : "hover:bg-slate-50/60"
                                            }`}
                                        >
                                            <td className="py-3.5 px-4">
                                                <div className={`font-semibold ${item.daysLeft < 0 ? "text-red-700" : "text-slate-800"}`}>
                                                    {item.daysLeft < 0 && "⚠️ "}{item.name}
                                                </div>
                                                <div className="text-[11px] text-slate-400">SKU: {item.sku}</div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-xs">
                                                {item.batchNo === "N/A" ? (
                                                    <span className="text-slate-300">—</span>
                                                ) : (
                                                    <span className="text-slate-600 font-medium">{item.batchNo}</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                                {item.stock}
                                            </td>
                                            <td className={`py-3.5 px-4 text-center font-semibold ${item.daysLeft < 0 ? "text-red-700" : "text-slate-800"}`}>
                                                {formatDate(item.expiryDate)}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border ${badgeStyle}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                                    {statusText}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => alert(`Discount or Return action for: ${item.name}`)}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* পেজিনেশন ফুটার */}
                {!loading && sortedProducts.length > 0 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <span>Show:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none"
                            >
                                <option value={10}>10 per page</option>
                                <option value={15}>15 per page</option>
                                <option value={25}>25 per page</option>
                            </select>
                            <span>Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedProducts.length)} of {sortedProducts.length} entries</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>

                            <span className="px-3 py-1 font-bold text-slate-800">
                                Page {currentPage} of {totalPages || 1}
                            </span>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}