import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Search,
  Download,
  PiggyBank,
  ArrowUpRightSquare,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  ArrowRightLeft,
  Smartphone
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AccountsPage() {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
  const currentShopId = storedUser?.shopId || 1;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'INCOME' | 'OUT'
  const [searchTerm, setSearchTerm] = useState('');

  // পেজিনেশন স্টেট
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // ডাটা স্টেটস
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    totalReceivable: 0,
    totalPayable: 0,
    totalSales: 0,
    totalExpense: 0,
    totalInvestedCapital: 0
  });
  const [transactions, setTransactions] = useState([]);

  // ফরম স্টেটস
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalAccountId, setCapitalAccountId] = useState('');
  const [capitalNote, setCapitalNote] = useState('');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountId, setWithdrawAccountId] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');

  useEffect(() => {
    if (currentShopId) {
      fetchAccountData();
    }
  }, [currentShopId]);

  // ব্যাকএন্ড থেকে ডেটা ফেচ করা
  const fetchAccountData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // আপনার ব্যাকএন্ড রাউটের সাথে মিলিয়ে এন্ডপয়েন্টগুলো সেট করবেন
      const [accRes, summaryRes, txRes] = await Promise.all([
        fetch(`${API_URL}/accounts?shopId=${currentShopId}`, { headers }),
        fetch(`${API_URL}/accounts/summary?shopId=${currentShopId}`, { headers }),
        fetch(`${API_URL}/accounts/transactions?shopId=${currentShopId}`, { headers })
      ]);

      const accData = await accRes.json();
      const summaryData = await summaryRes.json();
      const txData = await txRes.json();

      if (accData.success) {
        setAccounts(accData.data);
        if (accData.data.length > 0) {
          setCapitalAccountId(accData.data[0].id);
          setWithdrawAccountId(accData.data[0].id);
        }
      }

      if (summaryData.success) {
        setSummary(summaryData.data);
      }

      if (txData.success) {
        setTransactions(txData.data);
      }
    } catch (err) {
      console.error("Error fetching accounts data:", err);
      setErrorMsg('সার্ভারের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি।');
    } finally {
      setLoading(false);
    }
  };

  // মূলধন ইনভেস্ট সাবমিট
  const handleAddCapital = async (e) => {
    e.preventDefault();
    if (!capitalAmount || Number(capitalAmount) <= 0 || !capitalAccountId) {
      alert('সঠিক পরিমাণ এবং অ্যাকাউন্ট নির্বাচন করুন।');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/accounts/capital`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(capitalAmount),
          accountId: Number(capitalAccountId),
          note: capitalNote,
          shopId: currentShopId
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('মূলধন সফলভাবে যুক্ত হয়েছে!');
        setCapitalAmount('');
        setCapitalNote('');
        fetchAccountData();
      } else {
        alert(data.message || 'মূলধন যোগ করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error("Capital add error:", err);
      alert('নেটওয়ার্ক ত্রুটি ঘটেছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // টাকা উত্তোলন (Withdrawal) সাবমিট
  const handleAddWithdrawal = async (e) => {
    e.preventDefault();
    if (!withdrawAmount || Number(withdrawAmount) <= 0 || !withdrawAccountId) {
      alert('সঠিক পরিমাণ এবং অ্যাকাউন্ট নির্বাচন করুন।');
      return;
    }

    const amt = Number(withdrawAmount);
    const selectedAcc = accounts.find(a => a.id === Number(withdrawAccountId));
    if (selectedAcc && amt > selectedAcc.balance) {
      alert(`পর্যাপ্ত ব্যালেন্স নেই! এই অ্যাকাউন্টে আছে: ৳ ${selectedAcc.balance}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/accounts/withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          accountId: Number(withdrawAccountId),
          note: withdrawNote,
          shopId: currentShopId
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('টাকা উত্তোলন সফলভাবে রেকর্ড করা হয়েছে!');
        setWithdrawAmount('');
        setWithdrawNote('');
        fetchAccountData();
      } else {
        alert(data.message || 'উত্তোলন রেকর্ড করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      console.error("Withdrawal error:", err);
      alert('নেটওয়ার্ক ত্রুটি ঘটেছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // ফিল্টারিং ও সার্চ লজিক
  const filteredTransactions = transactions.filter(tx => {
    const matchesTab = 
      activeTab === 'all' ? true : tx.type === activeTab;

    const matchesSearch = 
      (tx.note || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (tx.category || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // পেজিনেশন হিসাব
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 w-full p-4 sm:p-8 space-y-8 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Wallet size={20} /></span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Accounts & Finance Hub</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium pl-9">মাল্টি-অ্যাকাউন্ট ব্যালেন্স, ক্যাশ ফ্লো, মূলধন এবং সেন্ট্রাল ট্রানজাকশন লেজার</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAccountData}
            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs"
          >
            <Download size={16} /> রিফ্রেশ ডেটা
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 font-medium">
          <AlertCircle size={18} /> <span>{errorMsg}</span>
        </div>
      )}

      {/* ১. মাল্টি-অ্যাকাউন্ট ওভারভিউ কার্ডস (Cash, Bank, Bkash ইত্যাদি) */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ফান্ড ও অ্যাকাউন্টসমূহ (Accounts Balance)</h3>
        {loading ? (
          <div className="py-8 text-center text-slate-400 flex justify-center items-center gap-2 font-semibold">
            <Loader2 className="animate-spin text-indigo-600" size={20} /> অ্যাকাউন্ট ব্যালেন্স লোড হচ্ছে...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((acc) => {
              let IconComp = Wallet;
              let badgeColor = "bg-emerald-50 text-emerald-600";
              if (acc.type === 'BANK') {
                IconComp = Building2;
                badgeColor = "bg-blue-50 text-blue-600";
              } else if (acc.type === 'MOBILE_BANKING') {
                IconComp = Smartphone;
                badgeColor = "bg-indigo-50 text-indigo-600";
              }

              return (
                <div key={acc.id} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700">{acc.name}</span>
                    <div className={`p-2.5 rounded-2xl group-hover:scale-110 transition ${badgeColor}`}>
                      <IconComp size={20} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 font-mono">৳ {Number(acc.balance || 0).toLocaleString()}</h2>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">
                      Type: {acc.type} {acc.accountNo ? `(${acc.accountNo})` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ২. ফাইন্যান্সিয়াল সামারি কার্ডস */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট মূলধন (Capital)</span>
          <h2 className="text-2xl font-black text-indigo-600 font-mono">৳ {(summary.totalInvestedCapital || 0).toLocaleString()}</h2>
          <span className="text-[11px] text-slate-500 font-semibold">ব্যবসায়ে মোট বিনিয়োগ</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট বিক্রি (Sales)</span>
          <h2 className="text-2xl font-black text-slate-900 font-mono">৳ {(summary.totalSales || 0).toLocaleString()}</h2>
          <span className="text-[11px] text-emerald-600 font-semibold">রেভিনিউ জেনারেটেড</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট পাওনা (Receivable)</span>
          <h2 className="text-2xl font-black text-emerald-600 font-mono">৳ {(summary.totalReceivable || 0).toLocaleString()}</h2>
          <span className="text-[11px] text-slate-500 font-semibold">কাস্টমার ডিউ</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">মোট দেনা (Payable)</span>
          <h2 className="text-2xl font-black text-rose-600 font-mono">৳ {(summary.totalPayable || 0).toLocaleString()}</h2>
          <span className="text-[11px] text-slate-500 font-semibold">সাপ্লায়ার ডিউ</span>
        </div>
      </div>

      {/* ৩. ফরম সেকশন: মূলধন ও উত্তোলন */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* মূলধন ইনভেস্ট ফরম */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><PiggyBank size={20} /></div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">মূলধন ইনভেস্ট করুন (Add Capital)</h2>
              <p className="text-[11px] text-slate-500">দোকানে নতুন মূলধন এনে নির্দিষ্ট অ্যাকাউন্টে যুক্ত করুন</p>
            </div>
          </div>

          <form onSubmit={handleAddCapital} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">অ্যাকাউন্ট সিলেক্ট করুন</label>
                <select
                  value={capitalAccountId}
                  onChange={(e) => setCapitalAccountId(e.target.value)}
                  className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none font-semibold text-slate-700"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (৳ {acc.balance})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">পরিমাণ (৳)</label>
                <input
                  type="number"
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  placeholder="যেমন: ৫০০০০"
                  className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">নোট / বিবরণ</label>
              <input
                type="text"
                value={capitalNote}
                onChange={(e) => setCapitalNote(e.target.value)}
                placeholder="যেমন: পার্সোনাল ক্যাশ ইনভেস্ট"
                className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />} মূলধন যোগ করুন
            </button>
          </form>
        </div>

        {/* টাকা উত্তোলন ফরম */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl"><ArrowUpRightSquare size={20} /></div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">টাকা উত্তোলন করুন (Withdrawal)</h2>
              <p className="text-[11px] text-slate-500">ব্যক্তিগত প্রয়োজনে নির্দিষ্ট অ্যাকাউন্ট থেকে টাকা তুলুন</p>
            </div>
          </div>

          <form onSubmit={handleAddWithdrawal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">অ্যাকাউন্ট সিলেক্ট করুন</label>
                <select
                  value={withdrawAccountId}
                  onChange={(e) => setWithdrawAccountId(e.target.value)}
                  className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none font-semibold text-slate-700"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (৳ {acc.balance})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">পরিমাণ (৳)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="যেমন: ৫০০০"
                  className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">নোট / কারণ</label>
              <input
                type="text"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                placeholder="যেমন: মালিকের ব্যক্তিগত খরচ"
                className="w-full border border-slate-300/80 rounded-2xl p-3 text-xs bg-slate-50/50 focus:bg-white outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />} টাকা উত্তোলন করুন
            </button>
          </form>
        </div>

      </div>

      {/* ৪. সেন্ট্রাল ট্রানজাকশন লেজার (Transaction Ledger Table) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
        
        {/* Table Controls */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 w-fit">
              <button
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                সকল লেনদেন
              </button>
              <button
                onClick={() => { setActiveTab('INCOME'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'INCOME' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                টাকা জমা (IN)
              </button>
              <button
                onClick={() => { setActiveTab('OUT'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'OUT' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                টাকা খরচ/প্রদান (OUT)
              </button>
            </div>

            {/* Per Page Selector */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/60">
              <span>প্রতি পেজে:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
              >
                <option value={15}>১৫ টি</option>
                <option value={20}>২০ টি</option>
                <option value={50}>৫০ টি</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="বিবরণ বা ক্যাটাগরি খুঁজুন..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-300/80 rounded-2xl text-xs bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/70 border-b border-slate-200/60 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">তারিখ</th>
                <th className="py-4 px-6">অ্যাকাউন্ট</th>
                <th className="py-4 px-6">ক্যাটাগরি</th>
                <th className="py-4 px-6">বিবরণ / নোট</th>
                <th className="py-4 px-6 text-center">টাইপ</th>
                <th className="py-4 px-6 text-right">পরিমাণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentItems.length > 0 ? (
                currentItems.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6 text-slate-500 font-medium">{tx.date}</td>
                    <td className="py-4 px-6 font-bold text-indigo-600">{tx.account?.name || 'Cash in Hand'}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{tx.category}</td>
                    <td className="py-4 px-6 text-slate-600">{tx.note || '—'}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full font-extrabold text-[11px] ${
                        tx.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`py-4 px-6 text-right font-black text-sm font-mono ${
                      tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {tx.type === 'IN' ? '+' : '-'} ৳ {Number(tx.amount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-semibold">কোনো ট্রানজ্যাকশন পাওয়া যায়নি।</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div>
            মোট লেনদেন: <span className="font-bold text-slate-900">{filteredTransactions.length}</span> টি 
            (পেজ <span className="font-bold text-slate-900">{currentPage}</span> / {totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40 flex items-center gap-1 font-bold cursor-pointer transition"
            >
              <ChevronLeft size={16} /> পূর্ববর্তী
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40 flex items-center gap-1 font-bold cursor-pointer transition"
            >
               পরবর্তী <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}