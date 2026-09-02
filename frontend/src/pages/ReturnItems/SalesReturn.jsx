import React, { useState, useEffect } from 'react';
import { 
  Search, AlertTriangle, CheckCircle2, ArrowLeft, Printer, 
  Loader2, Receipt, RotateCcw, ArrowRight, ChevronLeft, ChevronRight,
  Filter, Calendar, DollarSign
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function SalesReturn() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user'))
    : null;

  const currentShopId = user?.shopId;
  const currentUserId = user?.id;

  // ট্যাবস: "invoices_list" অথবা "process_return"
  const [activeTab, setActiveTab] = useState('invoices_list');

  // সেলস লিস্ট ও পেজিনেশন স্টেট
  const [salesList, setSalesList] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15); // ডিফল্ট ১৫টি

  // রিটার্ন প্রসেস স্টেট
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  const [invoiceData, setInvoiceData] = useState(null);
  const [items, setItems] = useState([]);

  const [refundMethod, setRefundMethod] = useState('CASH');
  const [returnReason, setReturnReason] = useState('DEFECTIVE');
  const [restockingFee, setRestockingFee] = useState(0);
  const [notes, setNotes] = useState('');

  // সব সেলস ইনভয়েস ফেচ
  useEffect(() => {
    if (currentShopId) {
      fetchSalesList();
    }
  }, [currentShopId]);

  const fetchSalesList = async () => {
    setLoadingSales(true);
    try {
      const res = await fetch(`${API_URL}/sales?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const list = data.data || (Array.isArray(data) ? data : []);
      setSalesList(list);
    } catch (err) {
      console.error("Error loading sales list:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  // ইনভয়েস ফেচ লজিক
  const fetchInvoiceDetails = async (queryVal) => {
    if (!currentShopId) {
      setErrorMsg('শপ আইডি পাওয়া যায়নি। পুনরায় লগইন করুন।');
      return;
    }

    setLoadingInvoice(true);
    setErrorMsg('');
    setInvoiceData(null);
    setSuccessData(null);

    try {
      const res = await fetch(
        `${API_URL}/returns/find-sale?query=${encodeURIComponent(queryVal)}&shopId=${currentShopId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`সার্ভার থেকে সঠিক JSON আসেনি (Status: ${res.status})।`);
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ইনভয়েস পাওয়া যায়নি।');
      }

      const sale = data.data;
      setInvoiceData(sale);

      const formattedItems = (sale.saleItems || []).map((item) => ({
        saleItemId: item.id,
        productId: item.productId,
        name: item.product?.name || `Product #${item.productId}`,
        soldQty: item.quantity,
        unitPrice: item.unitPrice,
        returnQty: 0,
        selected: false,
        condition: 'GOOD'
      }));

      setItems(formattedItems);
      setActiveTab('process_return');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleFetchInvoice = (e) => {
    e.preventDefault();
    if (!invoiceQuery.trim()) {
      setErrorMsg('অনুগ্রহ করে ইনভয়েস নম্বর বা মোবাইল নম্বর লিখুন।');
      return;
    }
    fetchInvoiceDetails(invoiceQuery);
  };

  const handleInitiateReturnFromList = (sale) => {
    setInvoiceQuery(sale.invoiceNo);
    fetchInvoiceDetails(sale.invoiceNo);
  };

  const handleToggleSelect = (productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const isSelected = !item.selected;
          return {
            ...item,
            selected: isSelected,
            returnQty: isSelected && item.returnQty === 0 ? 1 : item.returnQty
          };
        }
        return item;
      })
    );
  };

  const handleQtyChange = (productId, val) => {
    const rawVal = parseInt(val) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const validQty = Math.max(0, Math.min(rawVal, item.soldQty));
          return { ...item, returnQty: validQty, selected: validQty > 0 };
        }
        return item;
      })
    );
  };

  const handleConditionChange = (productId, condition) => {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, condition } : item))
    );
  };

  const subtotal = items.reduce(
    (acc, item) => (item.selected ? acc + item.returnQty * item.unitPrice : acc),
    0
  );
  const totalRefund = Math.max(0, subtotal - Number(restockingFee || 0));

  const handleSubmitReturn = async () => {
    const selectedItems = items.filter((item) => item.selected && item.returnQty > 0);

    if (selectedItems.length === 0) {
      alert('কমপক্ষে একটি পণ্যের রিটার্ন সংখ্যা (Return Qty) দিন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      shopId: currentShopId,
      saleId: invoiceData.id,
      customerId: invoiceData.customerId,
      receivedById: currentUserId,
      items: selectedItems.map((item) => ({
        productId: item.productId,
        quantity: item.returnQty,
        unitPrice: item.unitPrice,
        condition: item.condition
      })),
      restockingFee: Number(restockingFee) || 0,
      refundMethod,
      reason: returnReason,
      notes
    };

    try {
      const res = await fetch(`${API_URL}/returns/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`সার্ভার থেকে JSON আসেনি (Status: ${res.status})`);
      }

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'রিটার্ন সম্পন্ন করা যায়নি।');
      }

      setSuccessData(result.data);
      fetchSalesList();
      alert('রিটার্ন সফলভাবে সম্পন্ন হয়েছে!');
    } catch (err) {
      setErrorMsg(err.message || 'সার্ভার এরর হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setInvoiceData(null);
    setItems([]);
    setInvoiceQuery('');
    setSuccessData(null);
    setErrorMsg('');
    setRestockingFee(0);
    setNotes('');
  };

  // ফিল্টারিং লজিক
  const filteredSales = salesList.filter((s) => {
    const query = salesSearchQuery.toLowerCase();
    const inv = (s.invoiceNo || '').toLowerCase();
    const cust = (s.customer?.name || s.customerName || '').toLowerCase();
    const phone = (s.customer?.phone || s.customerPhone || '').toLowerCase();
    const matchesSearch = inv.includes(query) || cust.includes(query) || phone.includes(query);

    const matchesStatus = statusFilter === 'ALL' 
      ? true 
      : (s.paymentStatus || 'PAID').toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // পেজিনেশন ক্যালকুলেশন
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInvoices = filteredSales.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className=" mx-auto space-y-6">

        {/* টপ হেডার ও ন্যাভিগেশন বার */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <RotateCcw size={22} />
              </span>
              Sales & Return Center
            </h1>
            <p className="text-xs text-slate-500 mt-1">ইনভয়েস রেকর্ড ব্রাউজ করুন এবং আইটেম ফেরত নিশ্চিত করুন</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('invoices_list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'invoices_list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt size={16} /> Sales Invoices ({filteredSales.length})
            </button>
            <button
              onClick={() => setActiveTab('process_return')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'process_return'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw size={16} /> Process Return
            </button>
          </div>
        </div>

        {/* এরর স্টেট */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2 shadow-xs">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* -----------------------------------------------------------------
            ট্যাব ১: পেজিনেটেড সেলস ইনভয়েস লিস্ট
           ----------------------------------------------------------------- */}
        {activeTab === 'invoices_list' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
            {/* কন্ট্রোল বার: সার্চ, ফিল্টার এবং পার-পেজ সিলেক্টর */}
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="ইনভয়েস বা মোবাইল নম্বর খুঁজুন..."
                  value={salesSearchQuery}
                  onChange={(e) => {
                    setSalesSearchQuery(e.target.value);
                    setCurrentPage(1); // সার্চের সাথে সাথে পেজ ১-এ নেওয়া
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {/* স্ট্যাটাস ফিল্টার */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Filter size={14} />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">All Status</option>
                    <option value="PAID">Paid</option>
                    <option value="DUE">Due</option>
                    <option value="PARTIAL">Partial</option>
                  </select>
                </div>

                {/* প্রতি পেজে কতগুলো আইটেম থাকবে */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* টেবিল */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Invoice No</th>
                    <th className="py-3 px-5">Customer Info</th>
                    <th className="py-3 px-5 text-center">Items</th>
                    <th className="py-3 px-5">Total Amount</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSales ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
                        <Loader2 className="animate-spin inline mr-2" size={20} /> ইনভয়েস তালিকা লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : currentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                        কোনো বিক্রয় ইনভয়েস রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    currentInvoices.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">
                          {new Date(sale.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-600 text-xs">
                          {sale.invoiceNo}
                        </td>
                        <td className="py-3.5 px-5 text-slate-800">
                          <div className="font-semibold text-xs text-slate-900">
                            {sale.customer?.name || 'Walk-in Customer'}
                          </div>
                          {sale.customer?.phone && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {sale.customer.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            {(sale.saleItems || []).length} items
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-extrabold text-slate-900 font-mono">
                          ৳ {(sale.grandTotal || sale.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              sale.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {sale.paymentStatus || 'PAID'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleInitiateReturnFromList(sale)}
                            className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto border border-blue-200 hover:border-transparent shadow-2xs"
                          >
                            Return <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* পেজিনেশন ফুটার বার */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                দেখাচ্ছে <span className="font-bold text-slate-700">{filteredSales.length === 0 ? 0 : indexOfFirstItem + 1}</span> থেকে{' '}
                <span className="font-bold text-slate-700">{Math.min(indexOfLastItem, filteredSales.length)}</span> (মোট{' '}
                <span className="font-bold text-slate-700">{filteredSales.length}</span> টি রেকর্ড)
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* ডাইনামিক পেজ নম্বর বাটন */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((pageNum, idx, array) => {
                    const prev = array[idx - 1];
                    return (
                      <React.Fragment key={pageNum}>
                        {prev && pageNum - prev > 1 && <span className="px-1.5 text-slate-400">...</span>}
                        <button
                          onClick={() => handlePageChange(pageNum)}
                          className={`min-w-8 h-8 rounded-lg font-bold transition ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            ট্যাব ২: রিটার্ন প্রসেস ফর্ম (মূল সেলস রিটার্ন)
           ----------------------------------------------------------------- */}
        {activeTab === 'process_return' && (
          <div className="space-y-6">
            {/* সাকসেস স্টেট */}
            {successData && (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-emerald-900 text-base flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    রিটার্ন ইনভয়েস: {successData.returnInvoiceNo}
                  </h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    সর্বমোট ফেরত: ৳ {successData.refundAmount?.toLocaleString()} | মাধ্যম: {successData.refundMethod}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-sm"
                  >
                    <Printer size={16} /> প্রিন্ট রশিদ
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    নতুন এন্ট্রি
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Search Form */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ইনভয়েস বা কাস্টমার মোবাইল নাম্বার দিয়ে খুঁজুন
              </label>
              <form onSubmit={handleFetchInvoice} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="उदा: INV-1001 অথবা 017XXXXXXXX"
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingInvoice}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
                >
                  {loadingInvoice ? <Loader2 size={18} className="animate-spin" /> : 'Fetch Bill'}
                </button>
              </form>

              {invoiceData && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg text-sm text-slate-700">
                  <div>
                    <span className="text-slate-500">ইনভয়েস:</span>{' '}
                    <span className="font-semibold text-blue-900">{invoiceData.invoiceNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">গ্রাহক:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {invoiceData.customer?.name || 'সাধারণ ক্রেতা'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">তারিখ:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {new Date(invoiceData.createdAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">বকেয়া ছিল:</span>{' '}
                    <span className="font-bold text-rose-600">৳ {invoiceData.dueAmount || 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Item Selection Table */}
            {invoiceData && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
                    আইটেম নির্বাচন ও রিটার্ন কন্ডিশন
                  </h2>
                  <span className="text-xs text-slate-500">ফেরত নেওয়ার আইটেম টিক দিন</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">ফেরত</th>
                        <th className="py-3 px-4">প্রোডাক্ট বিবরণ</th>
                        <th className="py-3 px-4 text-center">বিক্রি সংখ্যা</th>
                        <th className="py-3 px-4 text-center">মূল্য</th>
                        <th className="py-3 px-4 text-center w-28">ফেরত সংখ্যা</th>
                        <th className="py-3 px-4">পণ্যের বর্তমান অবস্থা (ইনভেন্টরি ফ্লো)</th>
                        <th className="py-3 px-4 text-right">মোট টাকা</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item) => (
                        <tr
                          key={item.productId}
                          className={item.selected ? 'bg-blue-50/30' : 'opacity-70 bg-white'}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelect(item.productId)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{item.soldQty}</td>
                          <td className="py-3 px-4 text-center text-slate-600">৳ {item.unitPrice}</td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={item.soldQty}
                              value={item.returnQty}
                              disabled={!item.selected}
                              onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-center font-semibold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                <input
                                  type="radio"
                                  name={`condition-${item.productId}`}
                                  checked={item.condition === 'GOOD'}
                                  disabled={!item.selected}
                                  onChange={() => handleConditionChange(item.productId, 'GOOD')}
                                />
                                ভালো (মেইন স্টক)
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                <input
                                  type="radio"
                                  name={`condition-${item.productId}`}
                                  checked={item.condition === 'DAMAGED'}
                                  disabled={!item.selected}
                                  onChange={() => handleConditionChange(item.productId, 'DAMAGED')}
                                />
                                নষ্ট (ড্যামেজ স্টক)
                              </label>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            ৳ {(item.selected ? item.returnQty * item.unitPrice : 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 3: Refund Options & Summary */}
            {invoiceData && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase border-b border-slate-100 pb-2">
                    রিটার্ন ও পেমেন্ট বিবরণ
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        ফেরত দেওয়ার কারণ
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="DEFECTIVE">পণ্য নষ্ট বা ছেঁড়া (Defective)</option>
                        <option value="WRONG_SIZE">সাইজ বা ফিটিং মিলছে না</option>
                        <option value="NOT_MATCHED">পছন্দ হয়নি / অমিল</option>
                        <option value="OTHER">অন্যান্য</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        রি-স্টকিং চার্জ / কর্তন (যদি থাকে)
                      </label>
                      <input
                        type="number"
                        value={restockingFee}
                        onChange={(e) => setRestockingFee(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="৳ 0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      রিফান্ড দেওয়ার মাধ্যম
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'CASH', label: 'Cash Out', desc: 'ক্যাশ ড্রয়ার থেকে নগদ' },
                        { id: 'STORE_CREDIT', label: 'Store Credit', desc: 'ভাউচার বা ওয়ালেট' },
                        { id: 'ADJUST_DUE', label: 'Adjust Due', desc: 'আগের বাকি থেকে কর্তন' }
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setRefundMethod(method.id)}
                          className={`p-3 text-left border rounded-lg transition ${
                            refundMethod === method.id
                              ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-semibold text-xs text-slate-800">{method.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{method.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      অভ্যন্তরীণ নোট (Internal Note)
                    </label>
                    <textarea
                      rows="2"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="রিটার্ন সম্পর্কিত কোনো বিশেষ মন্তব্য..."
                    ></textarea>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="md:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase border-b border-slate-100 pb-2">
                      হিসাবের সারসংক্ষেপ
                    </h2>
                    <div className="mt-4 space-y-2.5 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>ফেরত পণ্যের মোট দাম:</span>
                        <span className="font-semibold text-slate-900">৳ {subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>কর্তন / ফি (-):</span>
                        <span className="font-semibold">৳ {Number(restockingFee || 0).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 pt-3 mt-3 flex justify-between items-baseline">
                        <span className="text-base font-bold text-slate-800">সর্বমোট ফেরত:</span>
                        <span className="text-2xl font-black text-blue-600">
                          ৳ {totalRefund.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg text-sm font-semibold transition"
                    >
                      ক্যান্সেল
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReturn}
                      disabled={subtotal === 0 || submitting}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow transition"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> প্রসেসিং...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> প্রসেস রিটার্ন
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}