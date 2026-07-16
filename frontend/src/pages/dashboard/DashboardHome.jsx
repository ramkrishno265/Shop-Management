import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardHome() {
  const navigate = useNavigate();
  // ডেমো ডেটা (কোনো এক্সটার্নাল আইকন লাইব্রেরি লাগবে না)
  const kpiCards = [
    { title: "Today's Sales", value: '৳ ২৫,৫০০', change: '+১২% গত কাল থেকে', icon: '💰', color: 'border-green-500 bg-green-50/50' },
    { title: "Today's Invoices", value: '৪২ টি বিল', change: '+৪% আজ দুপুরে', icon: '🛍️', color: 'border-blue-500 bg-blue-50/50' },
    { title: 'Low Stock Items', value: '৫ টি প্রোডাক্ট', change: 'দ্রুত রি-অর্ডার করুন', icon: '⚠️', color: 'border-amber-500 bg-amber-50/50' },
    { title: 'Total Products', value: '১২৮ টি আইটেম', change: '৪টি ক্যাটাগরিতে বিভক্ত', icon: '📦', color: 'border-purple-500 bg-purple-50/50' },
  ];

  const recentInvoices = [
    { id: 'INV-2026-001', customer: 'Walk-in Customer', amount: '৳ ১,২৫০', method: 'CASH', time: '১০ মিনিট আগে' },
    { id: 'INV-2026-002', customer: 'Abdur Rahman', amount: '৳ ৩,৪০০', method: 'BKASH', time: '২৫ মিনিট আগে' },
    { id: 'INV-2026-003', customer: 'Walk-in Customer', amount: '৳ ৬০০', method: 'CASH', time: '১ ঘণ্টা আগে' },
    { id: 'INV-2026-004', customer: 'Sultana Razia', amount: '৳ ২,২০০', method: 'CARD', time: '২ ঘণ্টা আগে' },
  ];

  const lowStockProducts = [
    { name: 'Slim Fit Blue Jeans', sku: 'SKU-CLTH-P02', stock: '৩ পিস' },
    { name: 'Anker PowerBank 20k', sku: 'SKU-SHOP2-003', stock: '৪ পিস' },
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
        className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm➡️">
          
          <span>➕</span> New Sale (POS)
        </button>
      </div>

      {/* 📊 ১. টপ কেপিআই কার্ডস (Grid-4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-2xl border-l-4 border-t border-r border-b border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-md ${card.color}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{card.value}</h3>
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
        
        {/* 🛍️ বাম পাশের কলাম: সাম্প্রতিক ইনভয়েস টেবিল (৬৬% উইডথ) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800">Recent Invoices</h2>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View All ↗
              </button>
            </div>
            
            <div className="overflow-x-auto">
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
                        <button className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium transition-colors" title="View Details">
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 🚨 ডান পাশের কলাম: লো স্টক ও কুইক ফিড (৩৩% উইডথ) */}
        <div className="space-y-6">
          {/* লো স্টক অ্যালার্টカード */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Low Stock Notifications
            </h2>
            
            <div className="space-y-3">
              {lowStockProducts.map((prod, i) => (
                <div key={i} className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{prod.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{prod.sku}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-1 rounded-lg">
                    {prod.stock}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* সিস্টেম কুইক স্ট্যাটাস */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <h3 className="text-base font-bold mb-1.5">POS Billing Active 🛍️</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              আপনার কাউন্টারটি সেলস নেওয়ার জন্য সম্পূর্ণ প্রস্তুত। কীবোর্ড থেকে সরাসরি কুইক সেলস উইন্ডো চালু করতে পারেন।
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