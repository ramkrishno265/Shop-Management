import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  RotateCcw,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Building2,
  Receipt,
  Check,
  X
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PurchaseReturnManager() {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
  const currentShopId = storedUser?.shopId;
  const currentUserId = storedUser?.id;

  // নেভিগেশন ও ট্যাব
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' | 'new-return'

  // ডেটা লোডিং স্টেট
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  // কালেকশনস
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);

  // পারচেজ ফিল্টার ও পেজিনেশন
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState(null);

  // রিটার্ন ফর্ম স্টেট
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseRefId, setPurchaseRefId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [settlementType, setSettlementType] = useState('REDUCE_PAYABLE');
  const [returnReason, setReturnReason] = useState('FABRIC_FLAW');
  const [notes, setNotes] = useState('');

  // প্রাথমিক ডেটা লোড
  useEffect(() => {
    if (currentShopId) {
      loadInitialData();
    }
  }, [currentShopId]);

  const loadInitialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resPurchases, resSuppliers, resProducts] = await Promise.all([
        fetch(`${API_URL}/purchases?shopId=${currentShopId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/suppliers?shopId=${currentShopId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/products?shopId=${currentShopId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [dataPurchases, dataSuppliers, dataProducts] = await Promise.all([
        resPurchases.json(),
        resSuppliers.json(),
        resProducts.json()
      ]);

      setPurchases(dataPurchases.data || []);
      
      const supList = dataSuppliers.data || [];
      setSuppliers(supList);
      if (supList.length > 0) {
        setSelectedSupplierId(supList[0].id.toString());
      }

      // রিটার্নযোগ্য পণ্য ও স্টক প্রিপারেশন
      const prodList = dataProducts.data || [];
      const tableRows = [];
      prodList.forEach((prod) => {
        if (prod.quantity > 0) {
          tableRows.push({
            id: `${prod.id}-main`,
            productId: prod.id,
            name: prod.name,
            sourceLocation: 'MAIN',
            availableQty: prod.quantity,
            unitCost: prod.purchasePrice || 0,
            returnQty: 0,
            selected: false
          });
        }
        if (prod.damagedQuantity > 0) {
          tableRows.push({
            id: `${prod.id}-damaged`,
            productId: prod.id,
            name: prod.name,
            sourceLocation: 'DAMAGED',
            availableQty: prod.damagedQuantity,
            unitCost: prod.purchasePrice || 0,
            returnQty: 0,
            selected: false
          });
        }
      });
      setItems(tableRows);
      console.log('Initial data loaded:', { purchases: dataPurchases.data, suppliers: supList, products: prodList });

    } catch (err) {
      setErrorMsg('ডেটা লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে রিফ্রেশ করুন।');
    } finally {
      setLoading(false);
    }
  };

  // পারচেজ লিস্ট ফিল্টারিং
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesSearch =
        p.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier =
        supplierFilter === 'ALL' || p.supplier_id?.toString() === supplierFilter;
      return matchesSearch && matchesSupplier;
    });
  }, [purchases, searchQuery, supplierFilter]);

  // পেজিনেশন ক্যালকুলেশন
  const totalPages = Math.ceil(filteredPurchases.length / pageSize) || 1;
  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  // টেবিল থেকে নির্দিষ্ট পারচেজ রিটার্ন ট্যাবে ট্রান্সফার করা
  const handleInitiateReturn = (purchase) => {
    setSelectedSupplierId(purchase.supplier_id.toString());
    setPurchaseRefId(purchase.id.toString());
    setInvoiceReference(purchase.invoiceNo);
    setActiveTab('new-return');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // রিটার্ন ফর্ম চেকবক্স এবং কোয়ান্টিটি
  const handleToggleSelect = (rowId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === rowId) {
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
        if (item.id === rowId) {
          const validQty = Math.max(0, Math.min(rawVal, item.availableQty));
          return { ...item, returnQty: validQty, selected: validQty > 0 };
        }
        return item;
      })
    );
  };

  const totalReturnAmount = items.reduce(
    (acc, item) => (item.selected ? acc + item.returnQty * item.unitCost : acc),
    0
  );

  const selectedSupplier = suppliers.find((s) => s.id.toString() === selectedSupplierId) || {
    name: 'N/A',
    phone: 'N/A',
    currentBalance: 0
  };

  // সাবমিট ডেবিট নোট
  const handleSubmitReturn = async () => {
    const selectedItems = items.filter((item) => item.selected && item.returnQty > 0);

    if (!selectedSupplierId) {
      alert('অনুগ্রহ করে একজন সাপ্লায়ার নির্বাচন করুন।');
      return;
    }
    if (selectedItems.length === 0) {
      alert('কমপক্ষে একটি পণ্যের ফেরত সংখ্যা নির্ধারণ করুন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      shopId: Number(currentShopId),
      supplierId: Number(selectedSupplierId),
      purchaseId: purchaseRefId ? Number(purchaseRefId) : null,
      createdById: Number(currentUserId),
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

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'ডেবিট নোট তৈরি ব্যর্থ হয়েছে।');
      }

      setSuccessData(result.data);
      loadInitialData();
    } catch (err) {
      setErrorMsg(err.message || 'সার্ভারে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetReturn = () => {
    setSuccessData(null);
    setPurchaseRefId('');
    setInvoiceReference('');
    setNotes('');
    setItems((prev) => prev.map((item) => ({ ...item, selected: false, returnQty: 0 })));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 w-full shadow-xs">
        <div className="w-full px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Purchase Operations</h1>
                <p className="text-xs text-slate-500">ক্রয় তালিকা ও সাপ্লায়ার ডেবিট নোট ব্যবস্থাপনা</p>
              </div>
            </div>

            {/* Main Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('purchases')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'purchases'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={16} />
                ক্রয় তালিকা (Purchases)
              </button>
              <button
                onClick={() => setActiveTab('new-return')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'new-return'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RotateCcw size={16} />
                নতুন রিটার্ন (Debit Note)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full px-4 sm:px-6 py-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-sm font-medium">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-700 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}

        {/* TAB 1: ALL PURCHASES LIST */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            {/* Control Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ইনভয়েস বা সাপ্লায়ার খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  <select
                    value={supplierFilter}
                    onChange={(e) => {
                      setSupplierFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
                  >
                    <option value="ALL">সকল সাপ্লায়ার</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id.toString()}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rows Per Page */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>প্রতি পেজে:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-slate-50 text-slate-700 font-medium"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">ইনভয়েস নম্বর</th>
                      <th className="py-3.5 px-4">তারিখ</th>
                      <th className="py-3.5 px-4">সাপ্লায়ার</th>
                      <th className="py-3.5 px-4 text-center">পরিমাণ</th>
                      <th className="py-3.5 px-4 text-right">মোট টাকা</th>
                      <th className="py-3.5 px-4 text-right">পরিশোধ</th>
                      <th className="py-3.5 px-4 text-right">বকেয়া</th>
                      <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                      <th className="py-3.5 px-4 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="py-12 text-center text-slate-400">
                          <Loader2 className="animate-spin inline-block mr-2" size={20} />
                          পারচেজ রেকর্ড লোড হচ্ছে...
                        </td>
                      </tr>
                    ) : paginatedPurchases.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-12 text-center text-slate-400">
                          কোনো পারচেজ ইনভয়েস পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      paginatedPurchases.map((p) => {
                        const statusColors = {
                          PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
                          DUE: 'bg-rose-50 text-rose-700 border-rose-200'
                        };
                        const currentStatus = p.payment_status?.toUpperCase() || 'DUE';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition group">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                              <Receipt size={16} className="text-slate-400" />
                              {p.invoiceNo}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{p.date}</td>
                            <td className="py-3.5 px-4 font-medium text-slate-800">
                              {p.supplier?.name || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                              {p.quantity} {p.packId ? 'Packs' : 'Units'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                              ৳ {p.total_amount?.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                              ৳ {(p.paid_amount || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-rose-600">
                              ৳ {(p.due_amount || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                  statusColors[currentStatus] || statusColors.DUE
                                }`}
                              >
                                {currentStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setSelectedPurchaseDetails(p)}
                                  title="ডিটেইলস দেখুন"
                                  className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-md transition cursor-pointer"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleInitiateReturn(p)}
                                  title="এই চালান থেকে রিটার্ন করুন"
                                  className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-md transition cursor-pointer"
                                >
                                  <RotateCcw size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  সর্বমোট <b>{filteredPurchases.length}</b> টির মধ্যে দেখাচ্ছে{' '}
                  <b>{filteredPurchases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</b>-
                  <b>{Math.min(filteredPurchases.length, currentPage * pageSize)}</b>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-semibold text-slate-800">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PURCHASE RETURN (DEBIT NOTE) FORM */}
        {activeTab === 'new-return' && (
          <div className="space-y-6">
            {/* Success Banner */}
            {successData && (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    ডেবিট নোট সফলভাবে প্রস্তুত হয়েছে: {successData.debitNoteNo}
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    মোট রিটার্ন মূল্য: ৳ {successData.totalAmount?.toLocaleString()} | নিষ্পত্তি:{' '}
                    {successData.settlementType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Printer size={15} /> প্রিন্ট ডেবিট নোট
                  </button>
                  <button
                    onClick={handleResetReturn}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    আরেকটি রিটার্ন করুন
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Supplier & Source Reference */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    সাপ্লায়ার নির্বাচন করুন
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  >
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.phone ? `(${sup.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    ক্রয় চালান রেফারেন্স (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={invoiceReference}
                    onChange={(e) => setInvoiceReference(e.target.value)}
                    placeholder="যেমন: INV-49202391"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  />
                </div>
              </div>

              {/* Supplier Info Snippet */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500">নাম:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedSupplier.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">ফোন:</span>{' '}
                  <span className="font-medium text-slate-700">{selectedSupplier.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">বর্তমান বকেয়া (Payable):</span>{' '}
                  <span className="font-bold text-rose-600">
                    ৳ {(selectedSupplier.currentBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Item Selection Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase">
                    রিটার্ন আইটেম তালিকা
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">যে পণ্যগুলো স্টক থেকে বাদ দেওয়া হবে</p>
                </div>
                <div className="text-xs text-slate-500">
                  নির্বাচিত আইটেম: <b>{items.filter((i) => i.selected).length}</b>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-200 uppercase text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">সিলেক্ট</th>
                      <th className="py-3 px-4">পণ্যের নাম</th>
                      <th className="py-3 px-4">ইনভেন্টরি সোর্স</th>
                      <th className="py-3 px-4 text-center">মজুদ পরিমাণ</th>
                      <th className="py-3 px-4 text-center">একক ক্রয়মূল্য</th>
                      <th className="py-3 px-4 text-center w-28">ফেরত সংখ্যা</th>
                      <th className="py-3 px-4 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                          কোনো ফেরতযোগ্য পণ্য পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className={item.selected ? 'bg-indigo-50/30' : 'opacity-60 bg-white'}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelect(item.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                            <Package size={16} className="text-slate-400" />
                            {item.name}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                                item.sourceLocation === 'DAMAGED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.sourceLocation === 'DAMAGED' ? 'Damaged Stock' : 'Main Warehouse'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-slate-600">
                            {item.availableQty}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-600">
                            ৳ {item.unitCost.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              max={item.availableQty}
                              value={item.returnQty}
                              disabled={!item.selected}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 text-center font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            ৳ {(item.selected ? item.returnQty * item.unitCost : 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3: Accounting Settlement & Final Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Settlement Settings */}
              <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase border-b border-slate-100 pb-2">
                  অ্যাকাউন্টিং ও কারণ
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    ফেরত দেওয়ার কারণ
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none"
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
                      {
                        id: 'REDUCE_PAYABLE',
                        title: 'বকেয়া বিল কর্তন (Adjust Due)',
                        desc: 'সাপ্লায়ারের দেনা থেকে মাইনাস হবে'
                      },
                      {
                        id: 'CASH_REFUND',
                        title: 'নগদ ফেরত (Cash Refund)',
                        desc: 'সাপ্লায়ার নগদ বা ব্যাংক রিফান্ড দেবে'
                      }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSettlementType(m.id)}
                        className={`p-3 text-left border rounded-lg transition cursor-pointer ${
                          settlementType === m.id
                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-800">{m.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    নোট ও মন্তব্য
                  </label>
                  <textarea
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="চালান রেফারেন্স, সমস্যা বা বিশেষ নির্দেশ..."
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none"
                  ></textarea>
                </div>
              </div>

              {/* Settlement Totals Card */}
              <div className="md:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase border-b border-slate-100 pb-2">
                    সারসংক্ষেপ
                  </h3>

                  <div className="mt-4 space-y-3 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>সাপ্লায়ারের বর্তমান দেনা:</span>
                      <span className="font-semibold text-slate-900">
                        ৳ {(selectedSupplier.currentBalance || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-indigo-600 font-medium">
                      <span>ডেবিট নোট ভ্যালু (ফেরত মূল্য):</span>
                      <span className="font-bold">৳ {totalReturnAmount.toLocaleString()}</span>
                    </div>

                    <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-800">সমন্বয়ের পর অবশিষ্ট দেনা:</span>
                      <span className="text-xl font-black text-emerald-600">
                        ৳{' '}
                        {Math.max(
                          0,
                          (selectedSupplier.currentBalance || 0) - totalReturnAmount
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleResetReturn}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    রিসেট
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReturn}
                    disabled={totalReturnAmount === 0 || submitting}
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> প্রক্রিয়াকরণ হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Check size={16} /> ডেবিট নোট ইস্যু করুন
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Purchase Details */}
        {selectedPurchaseDetails && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ইনভয়েস ডিটেইলস</h3>
                  <p className="text-xs text-slate-500">
                    চালান নং: <b>{selectedPurchaseDetails.invoiceNo}</b> ({selectedPurchaseDetails.date})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPurchaseDetails(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-400">সাপ্লায়ার:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {selectedPurchaseDetails.supplier?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">পেমেন্ট স্ট্যাটাস:</span>{' '}
                    <span className="font-semibold text-indigo-600">
                      {selectedPurchaseDetails.payment_status}
                    </span>
                  </div>
                </div>

                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2">পণ্য</th>
                      <th className="py-2 text-center">পরিমাণ</th>
                      <th className="py-2 text-center">দর</th>
                      <th className="py-2 text-right">মোট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPurchaseDetails.purchaseItems?.map((pi) => (
                      <tr key={pi.id}>
                        <td className="py-2 text-slate-800">{pi.productName || pi.product?.name}</td>
                        <td className="py-2 text-center">{pi.quantity}</td>
                        <td className="py-2 text-center">৳ {pi.unitPrice}</td>
                        <td className="py-2 text-right font-medium">৳ {pi.totalPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={() => {
                    const p = selectedPurchaseDetails;
                    setSelectedPurchaseDetails(null);
                    handleInitiateReturn(p);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw size={14} /> এই বিল থেকে রিটার্ন করুন
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}