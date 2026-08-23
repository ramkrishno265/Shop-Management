import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export default function DashboardHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayInvoicesCount: 0,
    lowStockCount: 0,
    totalProductsCount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  // নতুন স্টেট: সিলেক্ট করা ইনভয়েস এবং শপ ইনফো হ্যান্ডেল করার জন্য
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [shopInfo, setShopInfo] = useState({
    name: "Your Shop Name",
    address: "123, Retail Market, Dhaka, Bangladesh",
    phone: "+880 1234-567890",
    email: "info@shop.com",
    invoiceFooterNote: "Thank you for shopping with us!"
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // ইউজার অবজেক্ট বা আলাদা লোকাল স্টোরেজ থেকে shopId বের করা
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const shopId = user.shopId || user.shop_id || localStorage.getItem('shopId');

        // হেডার তৈরি (অথেন্টিকেশন টোকেন এবং শপ আইডি সহ)
        const headers = {
          Authorization: `Bearer ${token}`,
          ...(shopId && { 'x-shop-id': shopId }) // ব্যাকএন্ডে হেডারে শপ আইডি পাঠানো
        };

        // ১. ড্যাশবোর্ড সামারি, সেলস এবং প্রোডাক্টস ডেটা ফেচ করা
        const [salesRes, productsRes, shopRes] = await Promise.all([
          axios.get(`${API_URL}/sales`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/products`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/shop-profile`, { headers }).catch(() => ({ data: null }))
        ]);
        console.log("Fetched Data:", { salesRes, productsRes, shopRes });

        const sales = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data.data || []);
        const products = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.data || []);

        if (shopRes && shopRes.data) {
          setShopInfo(prev => ({ ...prev, ...shopRes.data }));
        }

        // আজকের মোট সেলস এবং ইনভয়েস হিসাব করা
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySalesList = sales.filter(s => s.createdAt && s.createdAt.startsWith(todayStr));
        const totalTodaySales = todaySalesList.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

        // লো স্টক প্রোডাক্ট ফিল্টার করা
        const lowStockList = products.filter(p => (p.quantity !== undefined ? p.quantity : p.stock) <= 5);

        setStats({
          todaySales: totalTodaySales,
          todayInvoicesCount: todaySalesList.length,
          lowStockCount: lowStockList.length,
          totalProductsCount: products.length
        });

        // সাম্প্রতিক ইনভয়েসগুলোর পুরো অবজেক্টগুলো ফরম্যাট করে সেভ রাখা
        // সাম্প্রতিক ইনভয়েসগুলোর পুরো অবজেক্টগুলো ফরম্যাট করে সেভ রাখা
        const formattedInvoices = sales.slice(0, 5).map(s => ({
          ...s,
          invoiceNo: s.invoiceNo || `INV-${s.id}`,
          customerName: s.customer ? s.customer.name : (s.customerName || 'Walk-in Customer'),
          customerPhone: s.customer ? s.customer.phone : (s.customerPhone || ''),
          cashierName: s.cashierName || 'Cashier',

          // ব্যাকএন্ডের ফিল্ড নাম অনুযায়ী প্রপার্টিগুলো ম্যাপ করা হলো
          subTotal: s.subtotal || s.grandTotal || 0,
          discount: s.discountAmount || s.discount || 0,
          totalPayable: s.grandTotal || 0,
          paidAmount: s.paidAmount || s.grandTotal || 0,
          changeBack: s.changeAmount || s.changeBack || 0,
          paymentMethod: s.paymentMethod || 'CASH',

          // এখানে saleItems থেকে আইটেমগুলো নেওয়া হচ্ছে
          items: s.saleItems || s.items || s.orderItems || [],

          time: s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          date: s.createdAt ? new Date(s.createdAt).toLocaleString() : ''
        }));

        setRecentInvoices(formattedInvoices);

        // লো স্টক লিস্ট ফরম্যাট করা
        const formattedLowStock = lowStockList.slice(0, 5).map(p => ({
          name: p.name,
          sku: p.sku || 'N/A',
          stock: `${p.quantity !== undefined ? p.quantity : p.stock} পিস`
        }));

        setLowStockProducts(formattedLowStock);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const kpiCards = [
    { title: "Today's Sales", value: `৳ ${stats.todaySales.toLocaleString()}`, change: 'আজকের মোট বিক্রি', icon: '💰', color: 'border-green-500 bg-green-50/50' },
    { title: "Today's Invoices", value: `${stats.todayInvoicesCount} টি বিল`, change: 'আজ সম্পন্ন হয়েছে', icon: '🛍️', color: 'border-blue-500 bg-blue-50/50' },
    { title: 'Low Stock Items', value: `${stats.lowStockCount} টি প্রোডাক্ট`, change: 'দ্রুত রি-অর্ডার করুন', icon: '⚠️', color: 'border-amber-500 bg-amber-50/50' },
    { title: 'Total Products', value: `${stats.totalProductsCount} টি আইটেম`, change: 'স্টকে', icon: '📦', color: 'border-purple-500 bg-purple-50/50' },
  ];

  return (
    <div className="p-1 text-slate-900">
      {/* 📑 হেডার সেকশন */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shop Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time statistics and quick shop metrics.</p>
        </div>
        <button
          onClick={() => navigate('/salePage')}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm">
          <span>➕</span> New Sale (POS)
        </button>
      </div>

      {/* 📊 ১. টপ কেপিআই কার্ডস */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-md ${card.color}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : card.value}</h3>
              <p className="text-xs text-slate-400 mt-1">{card.change}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* 🔄 মেইন ড্যাশবোর্ড কন্টেন্ট গ্রিড */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 🛍️ সাম্প্রতিক ইনভয়েস টেবিল */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800">Recent Invoices</h2>
              <button onClick={() => navigate('/sales')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View All ↗
              </button>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-10 text-center text-slate-400 text-sm">Loading invoices...</div>
              ) : recentInvoices.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">কোনো সাম্প্রতিক সেল বা ইনভয়েস পাওয়া যায়নি।</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-3 font-semibold">Invoice No</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Method</th>
                      <th className="pb-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentInvoices.map((inv, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-medium text-slate-700">{inv.invoiceNo}</td>
                        <td className="py-3.5 text-slate-600">
                          <div>{inv.customerName}</div>
                          <div className="text-[11px] text-slate-400">{inv.time}</div>
                        </td>
                        <td className="py-3.5 font-semibold text-slate-800">৳{inv.totalPayable}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${inv.paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-pink-50 text-pink-700 border border-pink-200'}`}>
                            {inv.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => {
                              setCurrentInvoice(inv);
                              setShowDetails(true);
                            }}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium transition-colors"
                            title="View Details"
                          >
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* 🚨 লো স্টক ও নোটিফিকেশন */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Low Stock Notifications
            </h2>
            <div className="space-y-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">সব প্রোডাক্টের স্টক পর্যাপ্ত আছে! 🎉</p>
              ) : (
                lowStockProducts.map((prod, i) => (
                  <div key={i} className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{prod.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{prod.sku}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-1 rounded-lg">
                      {prod.stock}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <h3 className="text-base font-bold mb-1.5">POS Billing Active 🛍️</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              আপনার কাউন্টারটি সেলস নেওয়ার জন্য সম্পূর্ণ প্রস্তুত।
            </p>
            <div className="text-xs font-mono text-slate-500 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              Counter Status: Operational
            </div>
          </div>
        </div>

      </div>

      {/* 📄 Invoice Details & Print Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">

          <div id="printable-invoice" className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

            {/* Header (Hidden during print) */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Invoice Preview</h2>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition"
              >
                ✕
              </button>
            </div>

            {/* Printable Invoice Body */}
            <div className="flex-1 p-5 text-slate-700 bg-white">

              <div className="text-center pb-4 border-b border-dashed border-slate-200">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {shopInfo.name}
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">{shopInfo.address}</p>
                <p className="text-[11px] text-slate-500">Phone: {shopInfo.phone}</p>

                <div className="mt-3 inline-block rounded-lg bg-slate-50 px-3 py-1 border border-slate-100 text-left">
                  <div className="flex justify-between gap-6 text-[11px]">
                    <span className="text-slate-500">Invoice No:</span>
                    <span className="font-semibold text-slate-800">{currentInvoice?.invoiceNo || "#INV-001"}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-[11px] mt-0.5">
                    <span className="text-slate-500">Date:</span>
                    <span className="font-semibold text-slate-800">{currentInvoice?.date || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="py-3 flex justify-between text-[11px] border-b border-dashed border-slate-200">
                <div>
                  <span className="text-slate-400 block">Customer:</span>
                  <span className="font-bold text-slate-800 text-xs">{currentInvoice?.customerName || "Walk-in Customer"}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Served By:</span>
                  <span className="font-bold text-slate-800 text-xs">{currentInvoice?.cashierName || "Cashier"}</span>
                </div>
              </div>

              <div className="py-3">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase">
                      <th className="py-1.5 font-semibold">Item</th>
                      <th className="py-1.5 text-center font-semibold">Qty</th>
                      <th className="py-1.5 text-right font-semibold">Price</th>
                      <th className="py-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {currentInvoice?.items && currentInvoice.items.length > 0 ? (
                      currentInvoice.items.map((item, index) => (
                        <tr key={index}>
                          <td className="py-2 font-medium text-slate-800">{item.name || item.productName || 'Product'}</td>
                          <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                          <td className="py-2 text-right text-slate-600">৳{item.price || item.unitPrice}</td>
                          <td className="py-2 text-right font-semibold text-slate-800">৳{item.total || (item.quantity * (item.price || item.unitPrice))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-3 text-center text-slate-400">No items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="py-3 border-t border-dashed border-slate-200 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Sub Total</span>
                  <span className="font-medium text-slate-800">৳{currentInvoice?.subTotal}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span className="font-medium text-slate-800">৳{currentInvoice?.discount}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                  <span>Total Payable</span>
                  <span>৳{currentInvoice?.totalPayable}</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-0.5">
                  <span>Paid ({currentInvoice?.paymentMethod})</span>
                  <span className="font-medium text-slate-800">৳{currentInvoice?.paidAmount}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Change</span>
                  <span className="font-medium text-emerald-600">৳{currentInvoice?.changeBack}</span>
                </div>
              </div>

              <div className="text-center pt-4 pb-1 border-t border-dashed border-slate-200 mt-1">
                <p className="text-[11px] font-semibold text-slate-800">{shopInfo.invoiceFooterNote}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Software powered by Matipul POS System</p>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3 print:hidden">
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-xs"
              >
                Close
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition"
              >
                <span>🖨️</span> Print Invoice
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}