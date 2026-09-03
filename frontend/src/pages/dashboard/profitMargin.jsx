import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Edit,
  Calendar,
  Wallet,
  Receipt,
  X
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
  const [cashDrawer, setCashDrawer] = useState(0);

  const [expenseCategory, setExpenseCategory] = useState("দোকান ভাড়া");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [expensesList, setExpensesList] = useState([]);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const currentShopId = user?.shopId;

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      let profitUrl = `${API_URL}/profit?type=${filterType}`;
      if (filterType === "custom" && startDate && endDate) {
        profitUrl += `&startDate=${startDate}&endDate=${endDate}`;
      }

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

      setNetProfit(totalProfit);
      setCashDrawer(cash - totalExpense);
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
    <div className="min-h-screen bg-slate-900/5 font-sans p-4 sm:p-8">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            শপ ম্যানেজমেন্ট ড্যাশবোর্ড
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            আপনার ব্যবসার দৈনিক আয়-ব্যয় এবং লাভ-লোকসানের রিয়েল-টাইম হিসাব
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 w-full sm:w-auto justify-center">
            <button
              onClick={() => setFilterType("today")}
              className={`flex-1 sm:flex-initial px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                filterType === "today"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              আজকের হিসাব
            </button>
            <button
              onClick={() => setFilterType("custom")}
              className={`flex-1 sm:flex-initial px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                filterType === "custom"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              তারিখ অনুযায়ী ফিল্টার
            </button>
          </div>

          {filterType === "custom" && (
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 w-full sm:w-auto">
              <Calendar size={16} className="text-indigo-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-slate-700 outline-none font-medium"
              />
              <span className="text-slate-400 text-xs">থেকে</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-slate-700 outline-none font-medium"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Metrics / KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Sales Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-indigo-100/60 transition-colors"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                মোট বিক্রি (Total Sales)
              </p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                ৳ {salesData?.totalSales ? salesData.totalSales.toLocaleString() : 0}
              </h3>
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs mt-3 font-semibold bg-emerald-50 w-fit px-2.5 py-1 rounded-full">
                <ArrowUpRight size={14} />
                <span>ক্যাশ: ৳ {salesData?.cashSales?.toLocaleString() || 0}</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
              <ShoppingBag size={26} />
            </div>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50/50 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-rose-100/60 transition-colors"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                মোট খরচ (Shop Expense)
              </p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">
                ৳ {expenseData.toLocaleString()}
              </h3>
              <p className="text-slate-500 text-xs mt-3 font-medium bg-rose-50 text-rose-600 w-fit px-2.5 py-1 rounded-full">
                দোকান খরচ, বিল ও অন্যান্য
              </p>
            </div>
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
              <ArrowDownRight size={26} />
            </div>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100/80 hover:shadow-md transition-shadow relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-100/60 transition-colors"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                নিট প্রফিট (Net Profit)
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-2">
                ৳ {netProfit.toLocaleString()}
              </h3>
              <p className="text-slate-500 text-xs mt-3 font-medium bg-emerald-50 text-emerald-700 w-fit px-2.5 py-1 rounded-full">
                মোট প্রফিট: ৳ {salesData?.totalProfit?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
              <TrendingUp size={26} />
            </div>
          </div>
        </div>
      </div>

      {/* Expense Form & Recent Expense Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Expense Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Receipt size={18} />
              </div>
              {editingExpenseId ? "খরচ এডিট করুন" : "নতুন খরচ এন্ট্রি"}
            </h2>
          </div>

          <form onSubmit={handleAddOrUpdateExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                খরচের খাত
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
              >
                <option value="দোকান ভাড়া">দোকান ভাড়া</option>
                <option value="বিদ্যুৎ বিল">বিদ্যুৎ বিল</option>
                <option value="কর্মচারীর বেতন">কর্মচারীর বেতন</option>
                <option value="চা ও নাস্তা">চা ও নাস্তা</option>
                <option value="অন্যান্য">অন্যান্য</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                টাকার পরিমাণ
              </label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="যেমন: ৫০০"
                className="w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                বিবরণ (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="যেমন: দুপুরের চা বিল"
                className="w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingExpense}
              className={`w-full text-white font-semibold py-3.5 rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                isSubmittingExpense
                  ? "bg-slate-400 cursor-not-allowed"
                  : editingExpenseId
                  ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
              }`}
            >
              {!isSubmittingExpense && !editingExpenseId && <Plus size={18} />}
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
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <X size={16} /> বাতিল করুন
              </button>
            )}
          </form>
        </div>

        {/* Recent Expense Table */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center">
                <Wallet size={18} />
              </div>
              সাম্প্রতিক খরচের ইতিহাস
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-2">খাত</th>
                  <th className="py-3.5 px-2">বিবরণ</th>
                  <th className="py-3.5 px-2">তারিখ</th>
                  <th className="py-3.5 px-2 text-right">পরিমাণ</th>
                  <th className="py-3.5 px-2 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {expensesList.length > 0 ? (
                  expensesList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-2 font-semibold text-slate-900">{item.category}</td>
                      <td className="py-4 px-2 text-slate-500 font-medium">{item.note}</td>
                      <td className="py-4 px-2 text-slate-400 text-xs font-semibold">{item.time}</td>
                      <td className="py-4 px-2 text-right font-bold text-rose-600">
                        -৳ {item.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="text-indigo-600 hover:text-indigo-800 p-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                            title="এডিট"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(item.id)}
                            className="text-rose-600 hover:text-rose-800 p-2 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                            title="ডিলিট"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 text-sm font-medium">
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