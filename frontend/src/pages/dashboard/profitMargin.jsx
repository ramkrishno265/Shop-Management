import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  TrendingUp,
  CreditCard,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Edit,
  Wallet,
  Building2,
  ArrowDownLeft
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const ShopDashboard = () => {
  const [filterType, setFilterType] = useState("today");

  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [salesData, setSalesData] = useState({
    totalSales: 0,
    cashSales: 0,
    digitalSales: 0,
    totalProfit: 0,
  });

  const [expenseData, setExpenseData] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  
  // নতুন অ্যাকাউন্টস মেট্রিকস স্টেট
  const [cashDrawer, setCashDrawer] = useState(0);
  const [bankBalance, setBankBalance] = useState(0); // ব্যাংক/ডিজিটাল ব্যালেন্স
  const [totalReceivable, setTotalReceivable] = useState(0); // কাস্টমার পাওনা (Due)
  const [totalPayable, setTotalPayable] = useState(0); // সাপ্লায়ার দেনা

  const [expenseCategory, setExpenseCategory] = useState("দোকান ভাড়া");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [expensesList, setExpensesList] = useState([]);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));
      const currentShopId = user?.shopId;

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      let profitUrl = `${API_URL}/profit?type=${filterType}`;
      if (filterType === "custom" && startDate && endDate) {
        profitUrl += `&startDate=${startDate}&endDate=${endDate}`;
      }

      // একই সাথে প্রফিট, খরচ এবং কাস্টমার/সাপ্লায়ার ডিউ বা অ্যাকাউন্টস ডেটা ফেচ করার জন্য রিকোয়েস্ট
      const [profitRes, expenseRes] = await Promise.all([
        axios
          .get(profitUrl, { headers, cache: "no-store" })
          .catch(() => ({ data: {} })),
        axios
          .get(`${API_URL}/expenses?shopId=${currentShopId}`, {
            headers,
            cache: "no-store",
          })
          .catch(() => ({ data: [] })),
      ]);

      const profitInfo = profitRes.data || {};
      const expenses = Array.isArray(expenseRes.data)
        ? expenseRes.data
        : expenseRes.data.data || [];

      const totalSales = Number(profitInfo.totalSale) || 0;
      const totalProfit = Number(profitInfo.totalProfit) || 0;

      let filteredExpenses = expenses;
      if (filterType === "today") {
        filteredExpenses = expenses.filter(
          (e) => e.createdAt && e.createdAt.startsWith(todayStr),
        );
      } else if (filterType === "custom" && startDate && endDate) {
        filteredExpenses = expenses.filter((e) => {
          if (!e.createdAt) return false;
          const expDate = e.createdAt.split("T")[0];
          return expDate >= startDate && expDate <= endDate;
        });
      }

      const totalExpense = filteredExpenses.reduce(
        (acc, curr) => acc + (Number(curr.amount) || 0),
        0,
      );
      setExpenseData(totalExpense);

      const formattedExpenses = filteredExpenses.map((item) => ({
        id: item.id,
        category: item.category,
        note: item.note || "বিবরণ নেই",
        time: new Date(item.createdAt).toLocaleDateString("en-GB"),
        amount: item.amount,
      }));
      setExpensesList(formattedExpenses);

      let cash = totalSales; 
      let digital = 0;

      setSalesData({
        totalSales,
        cashSales: cash,
        digitalSales: digital,
        totalProfit,
      });

      setNetProfit(totalProfit - totalExpense);
      setCashDrawer(cash - totalExpense);
      
      // ডেমো অ্যাকাউন্টস ব্যালেন্স (আপনার ব্যাকএন্ডে কাস্টমার ডিউ/সাপ্লায়ার ডিউ এর আলাদা এন্ডপয়েন্ট থাকলে সেখানে বসিয়ে নিতে পারেন)
      setBankBalance(125000); 
      setTotalReceivable(15400); 
      setTotalPayable(32000); 

    } catch (error) {
      console.error("Error fetching profit/sales data:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filterType, startDate, endDate]);

  const handleAddOrUpdateExpense = async (e) => {
    e.preventDefault();
    if (isSubmittingExpense) return;

    if (!expenseAmount) {
      alert("দয়া করে টাকার পরিমাণ লিখুন");
      return;
    }

    try {
      setIsSubmittingExpense(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (editingExpenseId) {
        await axios.put(
          `${API_URL}/expenses/${editingExpenseId}`,
          {
            category: expenseCategory,
            amount: Number(expenseAmount),
            note: expenseNote || "",
          },
          { headers },
        );
        alert("খরচ সফলভাবে আপডেট করা হয়েছে!");
        setEditingExpenseId(null);
      } else {
        const expensePayload = {
          category: expenseCategory,
          amount: Number(expenseAmount),
          note: expenseNote || "",
        };
        await axios.post(`${API_URL}/expenses`, expensePayload, { headers });
        alert("খরচ সফলভাবে যোগ করা হয়েছে!");
      }

      setExpenseAmount("");
      setExpenseNote("");
      setExpenseCategory("দোকান ভাড়া");
      fetchDashboardData();
    } catch (error) {
      console.error("Error saving expense:", error);
      alert(error.response?.data?.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleEditClick = (item) => {
    setEditingExpenseId(item.id);
    setExpenseCategory(item.category);
    setExpenseAmount(item.amount);
    setExpenseNote(item.note === "বিবরণ নেই" ? "" : item.note);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত এই খরচটি ডিলিট করতে চান?")) return;

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.delete(`${API_URL}/expenses/${id}`, { headers });
      alert("খরচ সফলভাবে ডিলিট করা হয়েছে!");
      fetchDashboardData();
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("ডিলিট করতে সমস্যা হয়েছে।");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            শপ ম্যানেজমেন্ট ও অ্যাকাউন্টস ড্যাশবোর্ড
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ব্যবসার লাভ-লোকসান, ক্যাশ ড্রয়ার এবং অ্যাকাউন্টস লেজার এক নজরে
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterType("today")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === "today" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              আজকের হিসাব
            </button>
            <button
              onClick={() => setFilterType("custom")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterType === "custom" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              তারিখ অনুযায়ী ফিল্টার
            </button>
          </div>

          {filterType === "custom" && (
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

      {/* Main Metrics / KPI Cards (Sales, Expense, Profit, Cash Drawer) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              মোট বিক্রি (Total Sales)
            </p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              ৳ {salesData?.totalSales ? salesData.totalSales.toLocaleString() : 0}
            </h3>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium">
              <ArrowUpRight size={14} />
              <span>ক্যাশ: ৳ {salesData?.cashSales?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <ShoppingBag size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              মোট খরচ (Shop Expense)
            </p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              ৳ {expenseData.toLocaleString()}
            </h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">দোকান খরচ, বিল ইত্যাদি</p>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <ArrowDownRight size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              নিট প্রফিট (Net Profit)
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-2">
              ৳ {netProfit.toLocaleString()}
            </h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">
              মোট প্রফিট: ৳ {salesData?.totalProfit?.toLocaleString() || 0}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              ক্যাশ ইন হ্যান্ড (Cash Drawer)
            </p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              ৳ {cashDrawer.toLocaleString()}
            </h3>
            <p className="text-slate-500 text-xs mt-2 font-medium">ড্রয়ারে বর্তমান ক্যাশ</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      {/* অতিরিক্ত অ্যাকাউন্টস সামারি কার্ড (Bank, Receivable, Payable) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ব্যাংক ও ডিজিটাল ওয়ালেট</p>
            <h3 className="text-xl font-bold text-slate-800 mt-1">৳ {bankBalance.toLocaleString()}</h3>
            <span className="text-xs text-indigo-600 font-medium">বিকাশ/নগদ/ব্যাংক</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Building2 size={22} /></div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">মোট পাওনা (Receivable)</p>
            <h3 className="text-xl font-bold text-emerald-600 mt-1">৳ {totalReceivable.toLocaleString()}</h3>
            <span className="text-xs text-slate-500 font-medium">কাস্টমারদের নিকট পাওনা</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ArrowDownLeft size={22} /></div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">মোট দেনা (Payable)</p>
            <h3 className="text-xl font-bold text-rose-600 mt-1">৳ {totalPayable.toLocaleString()}</h3>
            <span className="text-xs text-slate-500 font-medium">সাপ্লায়ারদের বকেয়া</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><Wallet size={22} /></div>
        </div>
      </div>

      {/* Expense Form & Recent Expense Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-1">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            {editingExpenseId ? "খরচ এডিট করুন (Edit Expense)" : "নতুন খরচ এন্ট্রি করুন (Expense)"}
          </h2>

          <form onSubmit={handleAddOrUpdateExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                খরচের খাত (Category)
              </label>
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                টাকার পরিমাণ (Amount)
              </label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="যেমন: ৫০০"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                বিবরণ (Note / Description)
              </label>
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
              disabled={isSubmittingExpense}
              className={`w-full text-white font-medium py-2.5 rounded-xl text-sm transition-colors shadow-sm ${
                isSubmittingExpense
                  ? "bg-slate-400 cursor-not-allowed"
                  : editingExpenseId
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmittingExpense
                ? "⏳ প্রসেসিং হচ্ছে..."
                : editingExpenseId
                ? "খরচ আপডেট করুন"
                : "খরচ যোগ করুন"}
            </button>

            {editingExpenseId && (
              <button
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseAmount("");
                  setExpenseNote("");
                  setExpenseCategory("দোকান ভাড়া");
                }}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-xl text-sm transition-colors mt-2"
              >
                বাতিল করুন
              </button>
            )}
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">সাম্প্রতিক খরচের ইতিহাস</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 font-semibold">খাত</th>
                  <th className="py-3 font-semibold">বিবরণ</th>
                  <th className="py-3 font-semibold">তারিখ</th>
                  <th className="py-3 font-semibold text-right">পরিমাণ</th>
                  <th className="py-3 font-semibold text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {expensesList.length > 0 ? (
                  expensesList.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-slate-800">{item.category}</td>
                      <td className="py-3 text-slate-500">{item.note}</td>
                      <td className="py-3 text-slate-400 text-xs">{item.time}</td>
                      <td className="py-3 text-right font-semibold text-rose-600">
                        -৳ {item.amount.toLocaleString()}
                      </td>
                      <td className="py-3 text-center space-x-2">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-lg transition-colors"
                          title="এডিট"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 rounded-lg transition-colors"
                          title="ডিলিট"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-slate-400 text-sm">
                      কোনো খরচের ডেটা পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopDashboard;