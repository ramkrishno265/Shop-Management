import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const PAGE_SIZE = 10;

export default function DueCustomersPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [allDueCustomers, setAllDueCustomers] = useState([]);

  // ---- Search / Filter / Sort / Pagination ----
  const [search, setSearch] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('all'); // all | fresh | mid | old
  const [sortBy, setSortBy] = useState('amount_desc'); // amount_desc | amount_asc | overdue_desc | overdue_asc | name_asc
  const [page, setPage] = useState(1);

  // ---- Collect payment modal ----
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [showCollectPayment, setShowCollectPayment] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectNote, setCollectNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [collectError, setCollectError] = useState('');

  const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 });

  useEffect(() => {
    fetchDueCustomers();
  }, []);

  const fetchDueCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const shopId = user.shopId;

      const headers = {
        Authorization: `Bearer ${token}`,
        ...(shopId && { 'x-shop-id': shopId })
      };

      const salesRes = await axios
        .get(`${API_URL}/sales`, { headers })
        .catch(() => ({ data: [] }));

      const sales = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data.data || []);

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const MS_PER_DAY = 1000 * 60 * 60 * 24;

      const dueMap = {};

      sales.forEach(s => {
        const due = Number(s.dueAmount) || 0;
        if (due <= 0) return;

        const custId = s.customerId || s.customer?.id || s.customerName || 'walkin';
        const custName = s.customer ? s.customer.name : (s.customerName || 'Walk-in Customer');
        const custPhone = s.customer ? s.customer.phone : (s.customerPhone || '');
        const saleDate = s.createdAt ? new Date(s.createdAt) : null;

        if (!dueMap[custId]) {
          dueMap[custId] = {
            id: custId,
            customerName: custName,
            phone: custPhone,
            dueAmount: 0,
            invoiceCount: 0,
            lastPaymentDate: null,
            _lastPaymentDateObj: null,
            _oldestDueDateObj: saleDate,
            invoices: []
          };
        }

        const entry = dueMap[custId];
        entry.dueAmount += due;
        entry.invoiceCount += 1;
        entry.invoices.push({
          invoiceNo: s.invoiceNo || `INV-${s.id}`,
          dueAmount: due,
          date: saleDate ? saleDate.toLocaleDateString('en-GB') : '—'
        });

        if (saleDate && (!entry._oldestDueDateObj || saleDate < entry._oldestDueDateObj)) {
          entry._oldestDueDateObj = saleDate;
        }

        if ((Number(s.paidAmount) || 0) > 0 && saleDate) {
          if (!entry._lastPaymentDateObj || saleDate > entry._lastPaymentDateObj) {
            entry._lastPaymentDateObj = saleDate;
            entry.lastPaymentDate = saleDate.toLocaleDateString('en-GB');
          }
        }
      });

      const dueList = Object.values(dueMap).map(c => {
        const daysOverdue = c._oldestDueDateObj
          ? Math.max(0, Math.floor((todayDate.getTime() - new Date(c._oldestDueDateObj).setHours(0, 0, 0, 0)) / MS_PER_DAY))
          : 0;
        return {
          id: c.id,
          customerName: c.customerName,
          phone: c.phone,
          dueAmount: c.dueAmount,
          invoiceCount: c.invoiceCount,
          lastPaymentDate: c.lastPaymentDate,
          daysOverdue,
          invoices: c.invoices
        };
      });

      setAllDueCustomers(dueList);
    } catch (err) {
      console.error('Error fetching due customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---- Derived summary stats ----
  const summary = useMemo(() => {
    const totalDue = allDueCustomers.reduce((acc, c) => acc + c.dueAmount, 0);
    const totalCustomers = allDueCustomers.length;
    const criticalCount = allDueCustomers.filter(c => c.daysOverdue > 30).length;
    const avgDue = totalCustomers > 0 ? totalDue / totalCustomers : 0;
    return { totalDue, totalCustomers, criticalCount, avgDue };
  }, [allDueCustomers]);

  // ---- Filter + search + sort pipeline ----
  const processedList = useMemo(() => {
    let list = [...allDueCustomers];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(search.trim())
      );
    }

    if (overdueFilter === 'fresh') {
      list = list.filter(c => c.daysOverdue <= 7);
    } else if (overdueFilter === 'mid') {
      list = list.filter(c => c.daysOverdue > 7 && c.daysOverdue <= 30);
    } else if (overdueFilter === 'old') {
      list = list.filter(c => c.daysOverdue > 30);
    }

    switch (sortBy) {
      case 'amount_asc':
        list.sort((a, b) => a.dueAmount - b.dueAmount);
        break;
      case 'overdue_desc':
        list.sort((a, b) => b.daysOverdue - a.daysOverdue);
        break;
      case 'overdue_asc':
        list.sort((a, b) => a.daysOverdue - b.daysOverdue);
        break;
      case 'name_asc':
        list.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
      case 'amount_desc':
      default:
        list.sort((a, b) => b.dueAmount - a.dueAmount);
        break;
    }

    return list;
  }, [allDueCustomers, search, overdueFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processedList.length / PAGE_SIZE));
  const pagedList = processedList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 whenever filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, overdueFilter, sortBy]);

  const overdueBadgeClass = (days) => {
    if (days > 30) return 'bg-red-50 text-red-700 border border-red-200';
    if (days > 7) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  };

  const openCollectModal = (cust) => {
    setCurrentCustomer(cust);
    setCollectAmount('');
    setCollectNote('');
    setCollectError('');
    setShowCollectPayment(true);
  };

  const handleSubmitCollectPayment = async () => {
    if (!currentCustomer) return;
    const amountNum = Number(collectAmount);

    if (!collectAmount || isNaN(amountNum) || amountNum <= 0) {
      setCollectError('সঠিক পরিমাণ লিখুন।');
      return;
    }
    if (amountNum > currentCustomer.dueAmount) {
      setCollectError('বকেয়া পরিমাণের চেয়ে বেশি নেওয়া যাবে না।');
      return;
    }

    try {
      setSubmittingPayment(true);
      setCollectError('');
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const shopId = user.shopId;

      const headers = {
        Authorization: `Bearer ${token}`,
        ...(shopId && { 'x-shop-id': shopId })
      };

      // NOTE: adjust this endpoint/payload to match your actual backend route
      // for recording a due-collection payment.
      await axios.post(
        `${API_URL}/customers/${currentCustomer.id}/collect-payment`,
        { amount: amountNum, note: collectNote },
        { headers }
      );

      setShowCollectPayment(false);
      fetchDueCustomers();
    } catch (err) {
      console.error('Error collecting payment:', err);
      setCollectError('পেমেন্ট সাবমিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="p-1 text-slate-900">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-0.5 w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition shadow-xs shrink-0"
              title="Back to Dashboard"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Due Customers</h1>
              <p className="text-sm text-slate-500 mt-0.5">সব বকেয়া কাস্টমারের তালিকা, সার্চ ও ফিল্টার সহ।</p>
            </div>
          </div>
          <button
            onClick={fetchDueCustomers}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-xs"
          >
            <span>🔄</span> Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 border-l-red-500 bg-red-50/50 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Due</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : `৳ ${fmt(summary.totalDue)}`}</h3>
              <p className="text-xs text-slate-400 mt-1">মোট বকেয়ার পরিমাণ</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">💸</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 border-l-blue-500 bg-blue-50/50 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due Customers</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : `${summary.totalCustomers} জন`}</h3>
              <p className="text-xs text-slate-400 mt-1">বকেয়া থাকা মোট কাস্টমার</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">👥</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 border-l-amber-500 bg-amber-50/50 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg. Due / Customer</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : `৳ ${fmt(summary.avgDue)}`}</h3>
              <p className="text-xs text-slate-400 mt-1">গড় বকেয়া</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">📊</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 border-l-rose-500 bg-rose-50/50 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">30+ Days Overdue</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : `${summary.criticalCount} জন`}</h3>
              <p className="text-xs text-slate-400 mt-1">জরুরি ভিত্তিতে ফলোআপ দরকার</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">⚠️</div>
          </div>
        </div>

        {/* Main card: search / filters / table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
            <div className="relative w-full lg:max-w-xs">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম বা নম্বর দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-300 transition"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Overdue filter pills */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                {[
                  { key: 'all', label: 'সব' },
                  { key: 'fresh', label: '≤ 7 দিন' },
                  { key: 'mid', label: '8–30 দিন' },
                  { key: 'old', label: '30+ দিন' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setOverdueFilter(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      overdueFilter === opt.key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800/10 transition"
              >
                <option value="amount_desc">Due: বেশি থেকে কম</option>
                <option value="amount_asc">Due: কম থেকে বেশি</option>
                <option value="overdue_desc">Overdue: বেশি দিন আগে</option>
                <option value="overdue_asc">Overdue: কম দিন আগে</option>
                <option value="name_asc">নাম (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Result count */}
          {!loading && (
            <p className="text-xs text-slate-400 mb-3">
              {processedList.length} জন কাস্টমার পাওয়া গেছে
              {search.trim() && <> — সার্চ: "{search.trim()}"</>}
            </p>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading due customers...</div>
            ) : pagedList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                {search.trim() || overdueFilter !== 'all'
                  ? 'কোনো মিল পাওয়া যায়নি — ফিল্টার বদলে দেখুন।'
                  : 'কোনো বকেয়া কাস্টমার পাওয়া যায়নি। 🎉'}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-medium">
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold">Due Amount</th>
                    <th className="pb-3 font-semibold">Invoices</th>
                    <th className="pb-3 font-semibold">Last Payment</th>
                    <th className="pb-3 font-semibold">Overdue</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedList.map((cust, i) => (
                    <tr key={cust.id ?? i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-medium text-slate-700">
                        <div>{cust.customerName}</div>
                        <div className="text-[11px] text-slate-400">{cust.phone || '—'}</div>
                      </td>
                      <td className="py-3.5 font-semibold text-red-600">৳{fmt(cust.dueAmount)}</td>
                      <td className="py-3.5 text-slate-600">{cust.invoiceCount} টি</td>
                      <td className="py-3.5 text-slate-600">{cust.lastPaymentDate || '—'}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${overdueBadgeClass(cust.daysOverdue)}`}>
                          {cust.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => openCollectModal(cust)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium transition-colors"
                          title="Collect Payment"
                        >
                          💰 Collect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && processedList.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-5 mt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== COLLECT PAYMENT MODAL ===================== */}
      {showCollectPayment && currentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <h2 className="text-sm font-bold text-slate-800">Collect Payment</h2>
              </div>
              <button
                onClick={() => setShowCollectPayment(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{currentCustomer.customerName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{currentCustomer.phone || 'No phone number'}</p>
              </div>

              <div className="flex items-center justify-between bg-red-50/60 border border-red-100 rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-slate-500">Total Due</span>
                <span className="text-lg font-bold text-red-600">৳{fmt(currentCustomer.dueAmount)}</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Collection Amount</label>
                <input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="৳ পরিমাণ লিখুন"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-300 transition"
                />
                <button
                  onClick={() => setCollectAmount(String(currentCustomer.dueAmount))}
                  className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  পুরো বকেয়া পরিমাণ বসাও (৳{fmt(currentCustomer.dueAmount)})
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note (optional)</label>
                <input
                  type="text"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  placeholder="যেমন: bKash এ পেমেন্ট নেওয়া হয়েছে"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-300 transition"
                />
              </div>

              {collectError && (
                <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {collectError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-3.5">
              <button
                onClick={() => setShowCollectPayment(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCollectPayment}
                disabled={submittingPayment}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>💰</span> {submittingPayment ? 'Submitting...' : 'Confirm Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}