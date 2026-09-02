import React, { useState, useEffect } from 'react';
import { Truck, ArrowLeft, CheckCircle2, AlertCircle, Printer, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PurchaseReturn() {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
  const currentShopId = storedUser?.shopId;
  const currentUserId = storedUser?.id;

  // লোডিং ও ফিডব্যাক স্টেট
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  // সাপ্লায়ার ও পারচেজ বিল স্টেট
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [billNo, setBillNo] = useState('');

  // রিটার্ন আইটেম লিস্ট
  const [items, setItems] = useState([]);

  // সেটেলমেন্ট ও রিটার্ন ফিল্ড
  const [settlementType, setSettlementType] = useState('REDUCE_PAYABLE'); // 'REDUCE_PAYABLE' or 'CASH_REFUND'
  const [returnReason, setReturnReason] = useState('FABRIC_FLAW');
  const [notes, setNotes] = useState('');

  // ১. প্রাথমিক ডেটা লোড (সাপ্লায়ার ও রিটার্নযোগ্য প্রোডাক্ট)
  useEffect(() => {
    if (currentShopId) {
      fetchSuppliersAndStock();
    }
  }, [currentShopId]);

  const fetchSuppliersAndStock = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // সাপ্লায়ার লিস্ট ফেচ
      const resSuppliers = await fetch(`${API_URL}/suppliers?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataSuppliers = await resSuppliers.json();
      const supList = dataSuppliers.data || [];
      setSuppliers(supList);
      if (supList.length > 0) {
        setSelectedSupplierId(supList[0].id.toString());
      }

      // রিটার্নযোগ্য পণ্য ও স্টক ফেচ (Product লিস্ট থেকে)
      const resProducts = await fetch(`${API_URL}/products?shopId=${currentShopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataProducts = await resProducts.json();
      const prodList = dataProducts.data || [];

      // টেবিলের উপযোগী করে সাজানো (মেইন ও ড্যামেজ স্টক আলাদা রো আকারে)
      const tableRows = [];
      prodList.forEach((prod) => {
        // মেইন স্টকে মাল থাকলে রিটার্ন অপশন
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
        // ড্যামেজ স্টকে মাল থাকলে রিটার্ন অপশন
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
    } catch (err) {
      setErrorMsg('সাপ্লায়ার বা পণ্য তালিকা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  // আইটেম নির্বাচন টগল
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

  // রিটার্ন সংখ্যা পরিবর্তন
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

  // মোট রিটার্ন মূল্য ক্যালকুলেশন
  const totalReturnAmount = items.reduce(
    (acc, item) => (item.selected ? acc + item.returnQty * item.unitCost : acc),
    0
  );

  const selectedSupplier = suppliers.find((s) => s.id.toString() === selectedSupplierId) || {
    name: 'N/A',
    phone: 'N/A',
    currentPayable: 0
  };

  // ২. ডেবিট নোট সাবমিট করা
  const handleSubmitReturn = async () => {
    const selectedItems = items.filter((item) => item.selected && item.returnQty > 0);

    if (!selectedSupplierId) {
      alert('অনুগ্রহ করে একজন সাপ্লায়ার নির্বাচন করুন।');
      return;
    }

    if (selectedItems.length === 0) {
      alert('কমপক্ষে একটি পণ্যের ফেরত সংখ্যা নির্বাচন করুন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      shopId: Number(currentShopId),
      supplierId: Number(selectedSupplierId),
      purchaseId: purchaseId ? Number(purchaseId) : null,
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
        throw new Error(result.message || 'সাপ্লায়ার রিটার্ন সম্পন্ন করা যায়নি।');
      }

      setSuccessData(result.data);
      alert('সাপ্লায়ার রিটার্ন সফলভাবে সম্পন্ন হয়েছে এবং ডেবিট নোট তৈরি হয়েছে!');
    } catch (err) {
      setErrorMsg(err.message || 'সার্ভার এরর হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  // ফর্ম রিসেট
  const handleReset = () => {
    setSuccessData(null);
    setErrorMsg('');
    setBillNo('');
    setPurchaseId('');
    setNotes('');
    fetchSuppliersAndStock();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className=" mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
              title="রিসেট করুন"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Purchase Return / Debit Note</h1>
              <p className="text-sm text-slate-500">সাপ্লায়ারকে মাল ফেরত ও দেনা অ্যাডজাস্টমেন্ট</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Inventory Outflow
            </span>
          </div>
        </div>

        {/* এরর স্টেট */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* সাকসেস স্টেট ও প্রিন্ট অপশন */}
        {successData && (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-emerald-900 text-base flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                ডেবিট নোট তৈরি হয়েছে: {successData.debitNoteNo}
              </h3>
              <p className="text-sm text-emerald-700 mt-1">
                মোট ফেরত মূল্য: ৳ {successData.totalAmount?.toLocaleString()} | ধরন: {successData.settlementType}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-sm"
              >
                <Printer size={16} /> প্রিন্ট ডেবিট নোট
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

        {/* Step 1: Supplier & Bill Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">সাপ্লায়ার নির্বাচন করুন</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              >
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} {sup.phone ? `(${sup.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">ক্রয় বিল নম্বর (ঐচ্ছিক)</label>
              <input
                type="text"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                placeholder="उदा: PO-9942"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-sm text-slate-700">
            <div>
              <span className="text-slate-500">নির্বাচিত সাপ্লায়ার:</span>{' '}
              <span className="font-semibold text-amber-950">{selectedSupplier.name}</span>
            </div>
            <div>
              <span className="text-slate-500">ফোন:</span>{' '}
              <span className="font-semibold text-slate-800">{selectedSupplier.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500">বর্তমান বকেয়া (Payable):</span>{' '}
              <span className="font-bold text-rose-600">
                ৳ {(selectedSupplier.currentPayable || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Step 2: Item Selection Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">
              ফেরতযোগ্য মাল ও ইনভেন্টরি সোর্স
            </h2>
            <span className="text-xs text-slate-500">মালগুলো আপনার স্টক থেকে মাইনাস ($-$) হয়ে যাবে</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin" size={20} /> পণ্য লোড হচ্ছে...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">ফেরত দেওয়ার মতো কোনো স্টক পাওয়া যায়নি।</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">ফেরত</th>
                    <th className="py-3 px-4">পণ্যের নাম ও বিবরণ</th>
                    <th className="py-3 px-4">ইনভেন্টরি সোর্স</th>
                    <th className="py-3 px-4 text-center">মজুদ সংখ্যা</th>
                    <th className="py-3 px-4 text-center">ক্রয়মূল্য (একক)</th>
                    <th className="py-3 px-4 text-center w-28">ফেরত সংখ্যা</th>
                    <th className="py-3 px-4 text-right">মোট টাকা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <tr key={item.id} className={item.selected ? 'bg-amber-50/20' : 'opacity-60 bg-white'}>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            item.sourceLocation === 'DAMAGED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.sourceLocation === 'DAMAGED' ? 'Damaged Stock' : 'Main Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">{item.availableQty}</td>
                      <td className="py-3 px-4 text-center text-slate-600">৳ {item.unitCost.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={item.availableQty}
                          value={item.returnQty}
                          disabled={!item.selected}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-center font-semibold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        ৳ {(item.selected ? item.returnQty * item.unitCost : 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Step 3: Accounting Settlement & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase border-b border-slate-100 pb-2">
              সেটেলমেন্ট ও কারণ
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">সাপ্লায়ারকে ফেরত দেওয়ার কারণ</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="FABRIC_FLAW">ত্রুটিপূর্ণ উপাদান / কালার নষ্ট (Damaged/Defective)</option>
                <option value="EXPIRED">মেয়াদোত্তীর্ণ বা নিম্নমান (Low Quality)</option>
                <option value="WRONG_ITEM">ভুল পণ্য ডেলিভারি হয়েছিল (Wrong Dispatch)</option>
                <option value="EXCESS_STOCK">চুক্তিমতে অতিরিক্ত পণ্য ফেরত (Over-supplied)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                সেটেলমেন্ট পদ্ধতি (অ্যাকাউন্টিং অ্যাডজাস্টমেন্ট)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'REDUCE_PAYABLE',
                    label: 'বকেয়া বিল কর্তন (Adjust Due)',
                    desc: 'সাপ্লায়ারের দেনা থেকে বাদ যাবে'
                  },
                  {
                    id: 'CASH_REFUND',
                    label: 'নগদ ফেরত (Cash Refund)',
                    desc: 'সাপ্লায়ার নগদ বা ব্যাংকে রিফান্ড দেবে'
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSettlementType(item.id)}
                    className={`p-3 text-left border rounded-lg transition ${
                      settlementType === item.id
                        ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-800">{item.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                সাপ্লায়ারের জন্য নোট (Debit Note Remarks)
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="লট নম্বর, চালান রেফারেন্স বা ত্রুটির বিস্তারিত নোট..."
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
                  <span>সাপ্লায়ারের বর্তমান দেনা:</span>
                  <span className="font-semibold text-slate-900">
                    ৳ {(selectedSupplier.currentPayable || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>ডেবিট নোট অ্যামাউন্ট (ফেরত মূল্য):</span>
                  <span className="font-semibold">৳ {totalReturnAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-3 mt-3 flex justify-between items-baseline">
                  <span className="text-base font-bold text-slate-800">সমন্বয়ের পর দেনা বাকি:</span>
                  <span className="text-2xl font-black text-emerald-600">
                    ৳ {Math.max(0, (selectedSupplier.currentPayable || 0) - totalReturnAmount).toLocaleString()}
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
                disabled={totalReturnAmount === 0 || submitting}
                className="flex-[2] bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow transition"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> ইস্যু হচ্ছে...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> ইস্যু ডেবিট নোট
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}