import React, { useState, useEffect } from 'react';
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
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const ShopDashboard = () => {
  // স্টেট ম্যানেজমেন্ট
  const [filterType, setFilterType] = useState('today'); // 'today' | 'custom'
  const [startDate, setStartDate] = useState('2026-07-27');
  const [endDate, setEndDate] = useState('2026-07-27');

  // সেলস ডাটা স্টেট
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    cashSales: 0,
    digitalSales: 0
  });

  const [expenseData, setExpenseData] = useState(3200);
  const [netProfit, setNetProfit] = useState(6800);
  const [cashDrawer, setCashDrawer] = useState(14800);

  // নতুন খরচ ফর্মের জন্য স্টেট
  const [expenseCategory, setExpenseCategory] = useState('দোকান ভাড়া');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  // সাম্প্রতিক খরচের তালিকা স্টেট
  const [expensesList, setExpensesList] = useState([
    { id: 1, category: 'চা ও নাস্তা', note: 'দুপুরের নাস্তা', time: 'আজ, দুপুর ২:১৫', amount: 120 },
    { id: 2, category: 'বিদ্যুৎ বিল', note: 'সাব-মিটার অ্যাডভান্স', time: 'আজ, সকাল ১০:০০', amount: 1500 },
    { id: 3, category: 'অন্যান্য', note: 'দোকান পরিষ্কারের সামগ্রী', time: 'গতকাল', amount: 300 },
  ]);

  // ব্যাকএন্ড থেকে সেলস ও প্রফিট ডেটা ফেচ এবং ফিল্টার করার ফাংশন
  const fetchProfitData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // সরাসরি /sales এবং /expenses এপিআই থেকে ডেটা নিয়ে আসা
      const [salesRes, expenseRes] = await Promise.all([
        axios.get(`${API_URL}/sales`, { headers, cache: 'no-store' }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/expenses`, { headers, cache: 'no-store' }).catch(() => ({ data: [] }))
      ]);

      const sales = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data.data || []);
      
      // ফিল্টার লজিক প্রয়োগ (আজকের হিসাব অথবা কাস্টম ডেট রেঞ্জ)
      let filteredSales = sales;
      const todayStr = new Date().toISOString().split('T')[0];

      if (filterType === 'today') {
        filteredSales = sales.filter(s => s.createdAt && s.createdAt.startsWith(todayStr));
      } else if (filterType === 'custom' && startDate && endDate) {
        filteredSales = sales.filter(s => {
          if (!s.createdAt) return false;
          const saleDate = s.createdAt.split('T')[0];
          return saleDate >= startDate && saleDate <= endDate;
        });
      }

      // মোট বিক্রি হিসাব করা
      const totalSales = filteredSales.reduce((acc, curr) => acc + (Number(curr.grand_total || curr.grandTotal) || 0), 0);

      // ক্যাশ ও ডিজিটাল আলাদা করা
      let cash = 0;
      let digital = 0;

      filteredSales.forEach(s => {
        const amount = Number(s.grand_total || s.grandTotal) || 0;
        const method = (s.paymentMethod || s.paymentType || '').trim().toUpperCase();
        if (method === 'CASH') {
          cash += amount;
        } else {
          digital += amount;
        }
      });

      setSalesData({
        totalSales,
        cashSales: cash,
        digitalSales: digital
      });

    } catch (error) {
      console.error("Error fetching profit/sales data:", error);
    }
  };

  // কম্পোনেন্ট লোড হলে বা ফিল্টার চেঞ্জ হলে এই useEffect কল হবে
  useEffect(() => {
    fetchProfitData();
  }, [filterType, startDate, endDate]);

  // খরচ সাবমিট হ্যান্ডলার
  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expenseAmount) return;

    const newExpense = {
      id: Date.now(),
      category: expenseCategory,
      note: expenseNote || 'বিবরণ নেই',
      time: 'এইমাত্র',
      amount: Number(expenseAmount)
    };

    setExpensesList([newExpense, ...expensesList]);
    setExpenseData(prev => prev + Number(expenseAmount));
    setExpenseAmount('');
    setExpenseNote('');
  };

// খরচ সাবমিট এবং ব্যাকএন্ডে পাঠানোর হ্যান্ডলার ফাংশন
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmount) {
      alert("দয়া করে টাকার পরিমাণ লিখুন");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // আপনার ড্যাশবোর্ডে শপ আইডি যেখান থেকে নেওয়া হয় (যেমন: লোকাল স্টোরেজ বা প্রপস)
      // উদাহরণস্বরূপ localStorage থেকে shopId নেওয়া হলো অথবা ১ ডিফল্ট রাখা হলো
      const currentShopId = localStorage.getItem('shopId') || 1; 

      const expensePayload = {
        category: expenseCategory,
        amount: Number(expenseAmount),
        note: expenseNote || '',
        shopId: Number(currentShopId)
      };

      // ব্যাকএন্ডে API রিকোয়েস্ট পাঠানো
      const response = await axios.post(`${API_URL}/expenses`, expensePayload, { headers });

      if (response.data.success) {
        // সফলভাবে সেভ হলে নতুন এক্সপেন্সটি লোকাল লিস্টের উপরে যোগ করে দেওয়া
        const savedExpense = response.data.data;
        
        const formattedNewExpense = {
          id: savedExpense.id,
          category: savedExpense.category,
          note: savedExpense.note || 'বিবরণ নেই',
          time: 'এইমাত্র',
          amount: savedExpense.amount
        };

        setExpensesList([formattedNewExpense, ...expensesList]);
        
        // মোট খরচ (expenseData) আপডেট করা
        setExpenseData(prev => prev + Number(expenseAmount));

        // ফর্মের ফিল্ডগুলো খালি করে দেওয়া
        setExpenseAmount('');
        setExpenseNote('');
        
        alert("খরচ সফলভাবে যোগ করা হয়েছে!");
        
        // চাইলে প্রফিট ডেটা পুনরায় ফেচ করতে পারেন
        fetchProfitData(); 
      }
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("খরচ যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };



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
              onClick={() => {
                setFilterType('today');
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              আজকের হিসাব
            </button>
            <button
              onClick={() => setFilterType('custom')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              তারিখ অনুযায়ী ফিল্টার
            </button>
          </div>

          {/* ডেট রেঞ্জ পিকার (যদি কাস্টম সিলেক্ট করা হয়) */}
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
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              ৳ {salesData?.totalSales ? salesData.totalSales.toLocaleString() : 0}
            </h3>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium">
              <ArrowUpRight size={14} />
              <span>
                ক্যাশ: ৳ {salesData?.cashSales ? salesData.cashSales.toLocaleString() : 0} | 
                ডিজিটাল: ৳ {salesData?.digitalSales ? salesData.digitalSales.toLocaleString() : 0}
              </span>
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
            <h3 className="text-2xl font-bold text-slate-800 mt-2">৳ {expenseData.toLocaleString()}</h3>
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
            <h3 className="text-2xl font-bold text-emerald-600 mt-2">৳ {netProfit.toLocaleString()}</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">খরচ বাদ দেওয়ার পর আসল লাভ</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* ক্যাশ ড্রয়ার ব্যালেন্স */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ক্যাশ ইন হ্যান্ড (Cash Drawer)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">৳ {cashDrawer.toLocaleString()}</h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">স্বয়ংক্রয়ভাবে আপডেটকৃত</p>
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

          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">খরচের খাত (Category)</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="দোকান ভাড়া">দোকান ভাড়া</option>
                <option value="বিদ্যুৎ বিল">বিদ্যুৎ বিল</option>
                <option value="কর্মচারীর বেতন">কর্মচারীর বেতন</option>
                <option value="চা ও নাস্তা">চা ও নাস্তা</option>
                <option value="অন্যান্য">অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">টাকার পরিমাণ (Amount)</label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="যেমন: ৫০০"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">বিবরণ (Note / Description)</label>
              <input
                type="text"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
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
                  <th className="py-3 font-semibold">সময়</th>
                  <th className="py-3 font-semibold text-right">পরিমাণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {expensesList.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 font-medium text-slate-800">{item.category}</td>
                    <td className="py-3 text-slate-500">{item.note}</td>
                    <td className="py-3 text-slate-400 text-xs">{item.time}</td>
                    <td className="py-3 text-right font-semibold text-rose-600">-৳ {item.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ShopDashboard;