import React, { useState, useEffect } from 'react';
import {
  Search, AlertTriangle, CheckCircle2, Printer,
  Loader2, Receipt, RotateCcw, ArrowRight, ChevronLeft, ChevronRight,
  Filter
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PurchaseReturn() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user'))
    : null;

  const currentShopId = user?.shopId;
  const currentUserId = user?.id;

  // ট্যাবস: "purchases_list" অথবা "process_return"
  const [activeTab, setActiveTab] = useState('purchases_list');

  // পারচেজ লিস্ট ও ফিল্টার স্টেট
  const [purchaseList, setPurchaseList] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // সাপ্লায়ার ও অ্যাকাউন্টস
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // রিটার্ন প্রসেস স্টেট
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  const [invoiceData, setInvoiceData] = useState(null);
  const [items, setItems] = useState([]);

  const [settlementType, setSettlementType] = useState('REDUCE_PAYABLE');
  const [returnReason, setReturnReason] = useState('FABRIC_FLAW');
  const [notes, setNotes] = useState('');

  // ইনিশিয়াল ডেটা ফেচ
  useEffect(() => {
    if (currentShopId) {
      fetchPurchaseList();
      fetchSuppliers();
      fetchAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId]);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchPurchaseList = async () => {
    setLoadingPurchases(true);
    try {
      const res = await fetch(`${API_URL}/purchases?shopId=${currentShopId}`, { headers: authHeaders });
      const data = await res.json();
      const list = data.data || (Array.isArray(data) ? data : []);
      setPurchaseList(list);
    } catch (err) {
      console.error("Error loading purchases:", err);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/suppliers?shopId=${currentShopId}`, { headers: authHeaders });
      const data = await res.json();
      setSuppliers(data.data || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts?shopId=${currentShopId}`, { headers: authHeaders });
      const result = await res.json();
      const accList = result.data || (Array.isArray(result) ? result : []);
      setAccounts(accList);

      // ডিফল্ট অ্যাকাউন্ট সিলেক্ট করা
      const defAcc = accList.find((a) => a.isDefault || a.type === 'CASH');
      if (defAcc) setSelectedAccountId(defAcc.id);
      else if (accList.length > 0) setSelectedAccountId(accList[0].id);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  // সর্বোচ্চ ফেরতযোগ্য সংখ্যা = ইনভয়েসের বাকি ফেরতযোগ্য সংখ্যা ও নির্বাচিত স্টকের মধ্যে যেটা কম
  const getMaxQty = (item, source = item.sourceLocation) => {
    const available = source === 'DAMAGED' ? item.damagedStock : item.mainStock;
    return Math.max(0, Math.min(item.returnableQty, available));
  };

  // ইনভয়েস ফেচ লজিক (সার্ভার থেকে ফেরতযোগ্য আইটেমসহ)
  const fetchInvoiceDetails = async (queryVal) => {
    if (!currentShopId) {
      setErrorMsg('শপ আইডি পাওয়া যায়নি। পুনরায় লগইন করুন।');
      return;
    }

    setLoadingInvoice(true);
    setErrorMsg('');
    setInvoiceData(null);
    setSuccessData(null);

    try {
      const res = await fetch(
        `${API_URL}/returns/find-purchase?query=${encodeURIComponent(queryVal.trim())}&shopId=${currentShopId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`সার্ভার থেকে সঠিক JSON আসেনি (Status: ${res.status})।`);
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ক্রয় ইনভয়েস পাওয়া যায়নি।');
      }

      const purchase = data.data;
      setInvoiceData(purchase);
      setSettlementType(Number(purchase.due_amount) > 0 ? 'REDUCE_PAYABLE' : 'CASH_REFUND');

      const formattedItems = (purchase.returnableItems || []).map((ri) => ({
        rowId: ri.productId,
        productId: ri.productId,
        name: ri.name,
        purchasedQty: ri.purchasedQty,
        returnedQty: ri.returnedQty,
        returnableQty: ri.returnableQty,
        unitCost: ri.unitCost,
        mainStock: ri.mainStock,
        damagedStock: ri.damagedStock,
        returnQty: 0,
        selected: false,
        sourceLocation: 'MAIN'
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
      setErrorMsg('অনুগ্রহ করে ক্রয় ইনভয়েস নম্বর লিখুন।');
      return;
    }
    fetchInvoiceDetails(invoiceQuery);
  };

  const handleInitiateReturnFromList = (purchase) => {
    setInvoiceQuery(purchase.invoiceNo);
    fetchInvoiceDetails(purchase.invoiceNo);
  };

  const handleToggleSelect = (rowId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId === rowId) {
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

  const handleQtyChange = (rowId, val) => {
    const rawVal = parseInt(val) || 0;
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId === rowId) {
          const validQty = Math.max(0, Math.min(rawVal, getMaxQty(item)));
          return { ...item, returnQty: validQty, selected: validQty > 0 };
        }
        return item;
      })
    );
  };

  const handleSourceChange = (rowId, sourceLocation) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId === rowId) {
          const max = getMaxQty(item, sourceLocation);
          return { ...item, sourceLocation, returnQty: Math.min(item.returnQty, max) };
        }
        return item;
      })
    );
  };

  const subtotal = items.reduce(
    (acc, item) => (item.selected ? acc + item.returnQty * item.unitCost : acc),
    0
  );

  const invoiceDue = Number(invoiceData?.due_amount || 0);
  const remainingPayable = Math.max(0, invoiceDue - subtotal);
  const exceedsDue = settlementType === 'REDUCE_PAYABLE' && subtotal > invoiceDue;

  const handleSubmitReturn = async () => {
    const selectedItems = items.filter((item) => item.selected && item.returnQty > 0);

    if (selectedItems.length === 0) {
      alert('কমপক্ষে একটি পণ্যের ফেরত সংখ্যা (Return Qty) দিন।');
      return;
    }
    if (settlementType === 'CASH_REFUND' && !selectedAccountId) {
      alert('রিফান্ড গ্রহণের অ্যাকাউন্ট সিলেক্ট করুন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      shopId: Number(currentShopId),
      supplierId: Number(invoiceData.supplier_id),
      purchaseId: Number(invoiceData.id),
      createdById: Number(currentUserId),
      accountId:
        settlementType === 'CASH_REFUND' && selectedAccountId
          ? Number(selectedAccountId)
          : undefined, // 👈 নগদ ফেরত হলে টাকা যে অ্যাকাউন্টে ঢুকবে
      settlementType,
      reason: returnReason,
      notes,
      items: selectedItems.map((item) => ({
        productId: item.productId,
        quantity: item.returnQty,
        unitCost: item.unitCost,
        sourceLocation: item.sourceLocation
      }))
    };

    try {
      const res = await fetch(`${API_URL}/returns/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`সার্ভার থেকে JSON আসেনি (Status: ${res.status})`);
      }

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'ডেবিট নোট তৈরি ব্যর্থ হয়েছে।');
      }

      setSuccessData(result.data);
      fetchPurchaseList();
      alert('পারচেজ রিটার্ন সফলভাবে সম্পন্ন হয়েছে!');
    } catch (err) {
      setErrorMsg(err.message || 'সার্ভার এরর হয়েছে।');
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
    setNotes('');
  };

  // ফিল্টারিং লজিক
  const filteredPurchases = purchaseList.filter((p) => {
    const query = purchaseSearchQuery.toLowerCase();
    const inv = (p.invoiceNo || '').toLowerCase();
    const sup = (p.supplier?.name || '').toLowerCase();
    const phone = (p.supplier?.phone || '').toLowerCase();
    const matchesSearch = inv.includes(query) || sup.includes(query) || phone.includes(query);

    const matchesStatus =
      statusFilter === 'ALL' ? true : (p.payment_status || 'DUE').toUpperCase() === statusFilter;

    const matchesSupplier =
      supplierFilter === 'ALL' || (p.supplier_id ?? '').toString() === supplierFilter;

    return matchesSearch && matchesStatus && matchesSupplier;
  });

  // পেজিনেশন ক্যালকুলেশন
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPurchases = filteredPurchases.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const statusStyle = (status) => {
    const s = (status || 'DUE').toUpperCase();
    if (s === 'PAID') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (s === 'PARTIAL') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-rose-50 text-rose-700 border border-rose-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="mx-auto space-y-6">

        {/* টপ হেডার ও ন্যাভিগেশন বার */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <RotateCcw size={22} />
              </span>
              Purchase & Return Center
            </h1>
            <p className="text-xs text-slate-500 mt-1">ক্রয় ইনভয়েস রেকর্ড ব্রাউজ করুন এবং সাপ্লায়ারকে পণ্য ফেরত নিশ্চিত করুন</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('purchases_list')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'purchases_list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt size={16} /> Purchase Invoices ({filteredPurchases.length})
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
            ট্যাব ১: পেজিনেটেড পারচেজ ইনভয়েস লিস্ট
            ----------------------------------------------------------------- */}
        {activeTab === 'purchases_list' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="ইনভয়েস বা সাপ্লায়ার খুঁজুন..."
                  value={purchaseSearchQuery}
                  onChange={(e) => {
                    setPurchaseSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Filter size={14} />
                  <select
                    value={supplierFilter}
                    onChange={(e) => {
                      setSupplierFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer max-w-[160px]"
                  >
                    <option value="ALL">সকল সাপ্লায়ার</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id.toString()}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Invoice No</th>
                    <th className="py-3 px-5">Supplier Info</th>
                    <th className="py-3 px-5 text-center">Items</th>
                    <th className="py-3 px-5">Total Amount</th>
                    <th className="py-3 px-5">Due</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPurchases ? (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-slate-400">
                        <Loader2 className="animate-spin inline mr-2" size={20} /> ক্রয় ইনভয়েস তালিকা লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : currentPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-slate-400 font-medium">
                        কোনো ক্রয় ইনভয়েস রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    currentPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">
                          {p.date
                            ? new Date(p.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '-'}
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-600 text-xs">
                          {p.invoiceNo}
                        </td>
                        <td className="py-3.5 px-5 text-slate-800">
                          <div className="font-semibold text-xs text-slate-900">
                            {p.supplier?.name || 'N/A'}
                          </div>
                          {p.supplier?.phone && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {p.supplier.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            {(p.purchaseItems || []).length || p.quantity || 0} items
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-extrabold text-slate-900 font-mono">
                          ৳ {(p.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-rose-600 font-mono text-xs">
                          ৳ {(p.due_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${statusStyle(p.payment_status)}`}
                          >
                            {p.payment_status || 'DUE'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleInitiateReturnFromList(p)}
                            className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto border border-blue-200 hover:border-transparent shadow-2xs cursor-pointer"
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

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                দেখাচ্ছে <span className="font-bold text-slate-700">{filteredPurchases.length === 0 ? 0 : indexOfFirstItem + 1}</span> থেকে{' '}
                <span className="font-bold text-slate-700">{Math.min(indexOfLastItem, filteredPurchases.length)}</span> (মোট{' '}
                <span className="font-bold text-slate-700">{filteredPurchases.length}</span> টি রেকর্ড)
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((pageNum, idx, array) => {
                    const prev = array[idx - 1];
                    return (
                      <React.Fragment key={pageNum}>
                        {prev && pageNum - prev > 1 && <span className="px-1.5 text-slate-400">...</span>}
                        <button
                          onClick={() => handlePageChange(pageNum)}
                          className={`min-w-8 h-8 rounded-lg font-bold transition cursor-pointer ${
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
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            ট্যাব ২: পারচেজ রিটার্ন (ডেবিট নোট) প্রসেস ফর্ম
            ----------------------------------------------------------------- */}
        {activeTab === 'process_return' && (
          <div className="space-y-6">
            {successData && (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-emerald-900 text-base flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    ডেবিট নোট: {successData.debitNoteNo}
                  </h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    সর্বমোট ফেরত: ৳ {successData.totalAmount?.toLocaleString()} | নিষ্পত্তি: {successData.settlementType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-sm cursor-pointer"
                  >
                    <Printer size={16} /> প্রিন্ট ডেবিট নোট
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer"
                  >
                    নতুন এন্ট্রি
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Search Form */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ক্রয় ইনভয়েস নম্বর দিয়ে খুঁজুন
              </label>
              <form onSubmit={handleFetchInvoice} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="যেমন: INV-49202391"
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingInvoice}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {loadingInvoice ? <Loader2 size={18} className="animate-spin" /> : 'Fetch Bill'}
                </button>
              </form>

              {invoiceData && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg text-sm text-slate-700">
                  <div>
                    <span className="text-slate-500">ইনভয়েস:</span>{' '}
                    <span className="font-semibold text-blue-900">{invoiceData.invoiceNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">সাপ্লায়ার:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {invoiceData.supplier?.name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">তারিখ:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {invoiceData.date ? new Date(invoiceData.date).toLocaleDateString('en-GB') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">বকেয়া আছে:</span>{' '}
                    <span className="font-bold text-rose-600">৳ {invoiceData.due_amount || 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Item Selection Table */}
            {invoiceData && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
                    আইটেম নির্বাচন ও স্টক সোর্স
                  </h2>
                  <span className="text-xs text-slate-500">সাপ্লায়ারকে ফেরত দেওয়ার আইটেম টিক দিন</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">ফেরত</th>
                        <th className="py-3 px-4">প্রোডাক্ট বিবরণ</th>
                        <th className="py-3 px-4 text-center">ক্রয় সংখ্যা</th>
                        <th className="py-3 px-4 text-center">ক্রয়মূল্য</th>
                        <th className="py-3 px-4 text-center w-28">ফেরত সংখ্যা</th>
                        <th className="py-3 px-4">কোন স্টক থেকে বাদ যাবে (ইনভেন্টরি ফ্লো)</th>
                        <th className="py-3 px-4 text-right">মোট টাকা</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                            এই ইনভয়েসে কোনো আইটেম পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => {
                          const maxQty = getMaxQty(item);
                          return (
                            <tr
                              key={item.rowId}
                              className={item.selected ? 'bg-blue-50/30' : 'opacity-75 bg-white'}
                            >
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  disabled={maxQty === 0}
                                  onChange={() => handleToggleSelect(item.rowId)}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {item.name}
                                {maxQty === 0 && (
                                  <div className="text-[11px] text-rose-500 font-normal">
                                    এই স্টকে ফেরতযোগ্য পণ্য নেই
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-600">
                                {item.purchasedQty}
                                {item.returnedQty > 0 && (
                                  <div className="text-[11px] text-amber-600">আগে ফেরত: {item.returnedQty}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-600">৳ {item.unitCost}</td>
                              <td className="py-3 px-4">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxQty}
                                  value={item.returnQty}
                                  disabled={!item.selected}
                                  onChange={(e) => handleQtyChange(item.rowId, e.target.value)}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-center font-semibold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                    <input
                                      type="radio"
                                      name={`source-${item.rowId}`}
                                      checked={item.sourceLocation === 'MAIN'}
                                      disabled={!item.selected}
                                      onChange={() => handleSourceChange(item.rowId, 'MAIN')}
                                    />
                                    মেইন স্টক ({item.mainStock})
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                    <input
                                      type="radio"
                                      name={`source-${item.rowId}`}
                                      checked={item.sourceLocation === 'DAMAGED'}
                                      disabled={!item.selected}
                                      onChange={() => handleSourceChange(item.rowId, 'DAMAGED')}
                                    />
                                    ড্যামেজ স্টক ({item.damagedStock})
                                  </label>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-900">
                                ৳ {(item.selected ? item.returnQty * item.unitCost : 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 3: Settlement Options & Summary */}
            {invoiceData && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase border-b border-slate-100 pb-2">
                    রিটার্ন ও সেটেলমেন্ট বিবরণ
                  </h2>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      ফেরত দেওয়ার কারণ
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="FABRIC_FLAW">ত্রুটিপূর্ণ উপাদান / কোয়ালিটি নষ্ট (Damaged)</option>
                      <option value="EXPIRED">মেয়াদোত্তীর্ণ বা নিম্নমান (Expired / Substandard)</option>
                      <option value="WRONG_ITEM">ভুল পণ্য পাঠানো হয়েছে (Wrong Dispatch)</option>
                      <option value="EXCESS_STOCK">অতিরিক্ত পণ্য প্রত্যাহার (Excess Supply)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      সেটেলমেন্ট পদ্ধতি (Settlement Method)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'REDUCE_PAYABLE', label: 'Adjust Due', desc: 'সাপ্লায়ারের দেনা থেকে মাইনাস হবে' },
                        { id: 'CASH_REFUND', label: 'Cash Refund', desc: 'সাপ্লায়ার নগদ বা ব্যাংক রিফান্ড দেবে' }
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSettlementType(method.id)}
                          className={`p-3 text-left border rounded-lg transition cursor-pointer ${
                            settlementType === method.id
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

                  {/* নগদ ফেরত হলে টাকা যে অ্যাকাউন্টে জমা হবে */}
                  {settlementType === 'CASH_REFUND' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        রিফান্ড গ্রহণের অ্যাকাউন্ট (যেখানে টাকা জমা হবে) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="">অ্যাকাউন্ট সিলেক্ট করুন</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                        <span>এই ইনভয়েসের বকেয়া:</span>
                        <span className="font-semibold text-slate-900">
                          ৳ {invoiceDue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>ফেরত পণ্যের মোট দাম (-):</span>
                        <span className="font-semibold">৳ {subtotal.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 pt-3 mt-3 flex justify-between items-baseline">
                        <span className="text-base font-bold text-slate-800">
                          {settlementType === 'CASH_REFUND' ? 'নগদ ফেরত পাবেন:' : 'সমন্বয়ের পর দেনা:'}
                        </span>
                        <span className="text-2xl font-black text-blue-600">
                          ৳ {(settlementType === 'CASH_REFUND' ? subtotal : remainingPayable).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {exceedsDue && (
                    <p className="mt-4 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                      ফেরত মূল্য ইনভয়েসের বকেয়ার চেয়ে বেশি। "Cash Refund" বেছে নিন অথবা সংখ্যা কমান।
                    </p>
                  )}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg text-sm font-semibold transition cursor-pointer"
                    >
                      ক্যান্সেল
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReturn}
                      disabled={subtotal === 0 || submitting || exceedsDue || !!successData}
                      className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow transition cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> প্রসেসিং...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> ডেবিট নোট ইস্যু করুন
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