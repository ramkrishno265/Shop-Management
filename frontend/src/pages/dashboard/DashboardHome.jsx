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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // ১. ড্যাশবোর্ড সামারি বা সেলস ডেটা ফেচ করা
        // (আপনার ব্যাকএন্ডে যদি ড্যাশবোর্ড স্ট্যাটাসের আলাদা রুট না থাকে, তবে সেলস এবং প্রোডাক্টস API থেকেও ডেটা ক্যালকুলেট করতে পারেন)
        const [salesRes, productsRes] = await Promise.all([
          axios.get(`${API_URL}/sales`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/products`, { headers }).catch(() => ({ data: [] }))
        ]);

        const sales = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data.data || []);
        const products = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.data || []);

        // আজকের মোট সেলস এবং ইনভয়েস হিসাব করা
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySalesList = sales.filter(s => s.createdAt && s.createdAt.startsWith(todayStr));
        
        const totalTodaySales = todaySalesList.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);
        
        // লো স্টক প্রোডাক্ট ফিল্টার করা (যেগুলোর quantity বা stock ৫ বা তার কম)
        const lowStockList = products.filter(p => (p.quantity !== undefined ? p.quantity : p.stock) <= 5);

        setStats({
          todaySales: totalTodaySales,
          todayInvoicesCount: todaySalesList.length,
          lowStockCount: lowStockList.length,
          totalProductsCount: products.length
        });

        // সাম্প্রতিক ৫টি ইনভয়েস সাজানো
        const formattedInvoices = sales.slice(0, 5).map(s => ({
          id: s.invoiceNo || `INV-${s.id}`,
          customer: s.customerName || (s.customer ? s.customer.name : 'Walk-in Customer'),
          amount: `৳ ${s.grandTotal || 0}`,
          method: s.paymentMethod || 'CASH',
          time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
    { title: "Today's Invoices", value: `${stats.todayInvoicesCount} টি বিল`, change: 'আজ সম্পন্ন হয়েছে', icon: '🛍️', color: 'border-blue-500 bg-blue-50/50' },
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
        {/* কুইক অ্যাকশন বাটন */}
        <button 
          onClick={() => navigate('/salePage')}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm">
          <span>➕</span> New Sale (POS)
        </button>
      </div>

      {/* 📊 ১. টপ কেপিআই কার্ডস (Grid-4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-2xl border-l-4 border-t border-r border-b border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-md ${card.color}`}>
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

      {/* 🔄 মেইন ড্যাশবোর্ড কন্টেন্ট গ্রিড (Two-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 🛍️ বাম পাশের কলাম: সাম্প্রতিক ইনভয়েস টেবিল */}
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
                        <td className="py-3.5 font-medium text-slate-700">{inv.id}</td>
                        <td className="py-3.5 text-slate-600">
                          <div>{inv.customer}</div>
                          <div className="text-[11px] text-slate-400">{inv.time}</div>
                        </td>
                        <td className="py-3.5 font-semibold text-slate-800">{inv.amount}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${
                            inv.method === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            inv.method === 'BKASH' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                            'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                            {inv.method}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button onClick={() => navigate('/sales')} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium transition-colors" title="View Details">
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

        {/* 🚨 ডান পাশের কলাম: লো স্টক ও কুইক ফিড */}
        <div className="space-y-6">
          {/* লো স্টক অ্যালার্ট কার্ড */}
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

          {/* সিস্টেম কুইক স্ট্যাটাস */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <h3 className="text-base font-bold mb-1.5">POS Billing Active 🛍️</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              আপনার কাউন্টারটি সেলস নেওয়ার জন্য সম্পূর্ণ প্রস্তুত। কীবোর্ড থেকে সরাসরি কুইক সেলস উইন্ডো চালু করতে পারেন।
            </p>
            <div className="text-xs font-mono text-slate-500 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              Counter Status: Operational
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}