import React, { useState } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Filter 
} from 'lucide-react';

const ShopDashboard = () => {
  // স্টেট ম্যানেজমেন্ট (ডেমো ডেটা)
  const [filterType, setFilterType] = useState('today'); // 'today' | 'custom'
  const [startDate, setStartDate] = useState('2026-07-27');
  const [endDate, setEndDate] = useState('2026-07-27');

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      
      {/* --- Header & Filter Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">শপ ম্যানেজমেন্ট ড্যাশবোর্ড</h1>
          <p className="text-sm text-slate-500 mt-1">আপনার দৈনিক ও মাসিক ব্যবসার হিসাব-নিকাশ এক নজরে</p>
        </div>

        {/* ফিল্টার অপশন */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setFilterType('today')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              আজকের হিসাব
            </button>
            <button 
              onClick={() => setFilterType('custom')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              তারিখ অনুযায়ী ফিল্টার
            </button>
          </div>

          {/* ডেট রেঞ্জ পিকার (যদি কাস্টম সিলেক্ট করা হয়) */}
          {filterType === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar size={16} className="text-slate-500" />
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none" 
              />
              <span className="text-slate-400 text-xs">থেকে</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none" 
              />
            </div>
          )}
        </div>
      </div>

      {/* --- Stat Cards Grid --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* মোট বিক্রি */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">মোট বিক্রি (Total Sales)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">৳ ২৫,৪০০</h3>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium">
              <ArrowUpRight size={14} />
              <span>ক্যাশ: ৳ ১৮,০০০ | ডিজিটাল: ৳ ৭,৪০০</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* মোট খরচ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">মোট খরচ (Shop Expense)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">৳ ৩,২০০</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">দোকান খরচ, চা-নাস্তা, বিল ইত্যাদি</p>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <ArrowDownRight size={24} />
          </div>
        </div>

        {/* নিট প্রফিট */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">নিট প্রফিট (Net Profit)</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-2">৳ ৬,৮০০</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">খরচ বাদ দেওয়ার পর আসল লাভ</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* ক্যাশ ড্রয়ার ব্যালেন্স */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ক্যাশ ইন হ্যান্ড (Cash Drawer)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">৳ ১৪,৮০০</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">স্বয়ংক্রয়ভাবে আপডেটকৃত</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <CreditCard size={24} />
          </div>
        </div>

      </div>

      {/* --- Action Buttons & Recent Transactions/Expenses Section --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* বাম দিকের সেকশন: এক্সপেন্স এন্ট্রি ফর্ম */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            নতুন খরচ এন্ট্রি করুন (Expense)
          </h2>
          
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">খরচের খাত (Category)</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option>দোকান ভাড়া</option>
                <option>বিদ্যুৎ বিল</option>
                <option>কর্মচারীর বেতন</option>
                <option>চা ও নাস্তা</option>
                <option>অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">টাকার পরিমাণ (Amount)</label>
              <input 
                type="number" 
                placeholder="যেমন: ৫০০" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500" 
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">বিবরণ (Note / Description)</label>
              <input 
                type="text" 
                placeholder="যেমন: দুপুরের চা বিল" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500" 
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-blue-200"
            >
              খরচ যোগ করুন (Save Expense)
            </button>
          </form>
        </div>

        {/* ডান দিকের সেকশন: সাম্প্রতিক খরচ ও বিক্রির তালিকা */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">সাম্প্রতিক খরচের ইতিহাস</h2>
            <span className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">সব দেখুন</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 font-semibold">খাত</th>
                  <th className="py-3 font-semibold">বিবরণ</th>
                  <th className="py-3 font-semibold">সময়</th>
                  <th className="py-3 font-semibold text-right">পরিমাণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                <tr>
                  <td className="py-3 font-medium text-slate-800">চা ও নাস্তা</td>
                  <td className="py-3 text-slate-500">দুপুরের নাস্তা</td>
                  <td className="py-3 text-slate-400 text-xs">আজ, দুপুর ২:১৫</td>
                  <td className="py-3 text-right font-semibold text-rose-600">-৳ ১২০</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-800">বিদ্যুৎ বিল</td>
                  <td className="py-3 text-slate-500">সাব-মিটার অ্যাডভান্স</td>
                  <td className="py-3 text-slate-400 text-xs">আজ, সকাল ১০:০০</td>
                  <td className="py-3 text-right font-semibold text-rose-600">-৳ ১,৫০০</td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-slate-800">অন্যান্য</td>
                  <td className="py-3 text-slate-500">দোকান পরিষ্কারের সামগ্রী</td>
                  <td className="py-3 text-slate-400 text-xs">গতকাল</td>
                  <td className="py-3 text-right font-semibold text-rose-600">-৳ ৩০০</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ShopDashboard;