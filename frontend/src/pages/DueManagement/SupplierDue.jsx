import React, { useState, useEffect } from "react";
import {
  Search,
  ArrowUpRight,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  Building,
  Calendar,
  CreditCard,
  Printer,
  Loader2,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function SupplierDue() {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const currentShopId = storedUser?.shopId;

  // ডেটা ও লোডিং স্টেট
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("DUE_ONLY"); // "ALL" or "DUE_ONLY"

  // পেমেন্ট মডাল স্টেট
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (currentShopId) {
      fetchSupplierDues();
    }
  }, [currentShopId]);

  // সাপ্লায়ার লিস্ট ও বকেয়া লোড
  const fetchSupplierDues = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/suppliers?shopId=${currentShopId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const result = await res.json();
      const list = result.data || (Array.isArray(result) ? result : []);
      setSuppliers(list);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setMessage({ type: "error", text: "সাপ্লায়ার ডেটা লোড করতে সমস্যা হয়েছে।" });
    } finally {
      setLoading(false);
    }
  };

  // বকেয়া পরিশোধ সাবমিট
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount);

    if (!amount || amount <= 0) {
      alert("সঠিক পেমেন্ট অ্যামাউন্ট লিখুন।");
      return;
    }

    const currentPayable = selectedSupplier?.currentPayable || 0;
    if (amount > currentPayable) {
      alert("বকেয়ার পরিমাণের চেয়ে বেশি পেমেন্ট করা যাবে না।");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/suppliers/pay-due`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shopId: currentShopId,
          supplierId: selectedSupplier.id,
          amount,
          paymentMethod,
          note: paymentNote,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "পেমেন্ট সম্পন্ন করা যায়নি।");
      }

      setMessage({ type: "success", text: "বকেয়া সফলভাবে পরিশোধ হয়েছে!" });
      setSelectedSupplier(null);
      setPayAmount("");
      setPaymentNote("");
      fetchSupplierDues(); // রিফ্রেশ লিস্ট
    } catch (err) {
      alert(err.message || "সার্ভার এরর হয়েছে।");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ফিল্টার করা সাপ্লায়ার লিস্ট
  const filteredSuppliers = suppliers.filter((sup) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (sup.name || "").toLowerCase().includes(q);
    const phoneMatch = (sup.phone || "").toLowerCase().includes(q);
    const payable = Number(sup.currentPayable || 0);

    const matchesSearch = nameMatch || phoneMatch;
    if (filterType === "DUE_ONLY") {
      return matchesSearch && payable > 0;
    }
    return matchesSearch;
  });

  // টোটাল হিসাব
  const totalPayableAll = suppliers.reduce(
    (sum, s) => sum + Number(s.currentPayable || 0),
    0
  );
  const totalSuppliersWithDue = suppliers.filter(
    (s) => Number(s.currentPayable || 0) > 0
  ).length;

  return (
    <div className="space-y-6  mx-auto">
      {/* ১. টপ হেডার ও অ্যালার্ট */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ArrowUpRight size={22} />
            </span>
            Supplier Due & Payable Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            সাপ্লায়ার ও মহাজনদের কাছে মোট দেনা ও বাকি পরিশোধের খাতা
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Printer size={15} /> রিপোর্ট প্রিন্ট করুন
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{message.text}</span>
          <button
            onClick={() => setMessage({ type: "", text: "" })}
            className="ml-auto text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ২. স্ট্যাটাস কার্ডস (KPI Summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">
              সর্বমোট দেনা (Total Due)
            </p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">
              ৳ {totalPayableAll.toLocaleString()}
            </h3>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">
              বকেয়া সাপ্লায়ার সংখ্যা
            </p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">
              {totalSuppliersWithDue} <span className="text-xs font-medium text-slate-400">জন</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <Building size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">
              মোট রেজিস্টার্ড সাপ্লায়ার
            </p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">
              {suppliers.length} <span className="text-xs font-medium text-slate-400">জন</span>
            </h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      {/* ৩. ফিল্টার ও সাপ্লায়ার টেবিল */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="সাপ্লায়ারের নাম বা ফোন নম্বর খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setFilterType("DUE_ONLY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === "DUE_ONLY"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              শুধু বকেয়া ({totalSuppliersWithDue})
            </button>
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              সকল সাপ্লায়ার ({suppliers.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-5">সাপ্লায়ার নাম</th>
                <th className="py-3 px-5">ফোন / ঠিকানা</th>
                <th className="py-3 px-5 text-center">স্ট্যাটাস</th>
                <th className="py-3 px-5 text-right">বাকি পরিমাণ (Payable)</th>
                <th className="py-3 px-5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    <Loader2 className="animate-spin inline mr-2" size={18} /> লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400 font-medium">
                    কোনো সাপ্লায়ার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => {
                  const payable = Number(sup.currentPayable || 0);
                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-800 text-sm">
                        {sup.name}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                          <Phone size={12} className="text-slate-400" />
                          {sup.phone || "N/A"}
                        </div>
                        {sup.address && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {sup.address}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            payable > 0
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {payable > 0 ? "বাকি রয়েছে" : "পরিশোধিত"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-black text-base font-mono text-slate-900">
                        ৳ {payable.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          disabled={payable <= 0}
                          onClick={() => {
                            setSelectedSupplier(sup);
                            setPayAmount(payable.toString()); // ডিফল্ট পুরো টাকা বসিয়ে দেওয়া
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer ${
                            payable > 0
                              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs active:scale-95"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <CreditCard size={13} /> পরিশোধ করুন
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ৪. পেমেন্ট পরিশোধ মডাল (Pay Modal) */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  বকেয়া পরিশোধ (Supplier Payment)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  সাপ্লায়ার: <span className="font-bold text-slate-700">{selectedSupplier.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl flex justify-between items-center text-sm">
              <span className="text-xs font-semibold text-rose-800">মোট বাকি রয়েছে:</span>
              <span className="font-black text-rose-600 text-base font-mono">
                ৳ {Number(selectedSupplier.currentPayable || 0).toLocaleString()}
              </span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  পরিশোধের পরিমাণ (টাকা) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedSupplier.currentPayable}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold font-mono text-slate-900"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500/20 font-semibold"
                >
                  <option value="CASH">ক্যাশ ড্রয়ার (Cash)</option>
                  <option value="BANK">ব্যাংক একাউন্ট (Bank Transfer)</option>
                  <option value="BKASH">বিকাশ / নগদ (Mobile Banking)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  নোট বা রেফারেন্স (ঐচ্ছিক)
                </label>
                <textarea
                  rows="2"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="ভাউচার বা ট্রানজেকশন নম্বর..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/20 resize-none font-medium"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  পরিশোধ কনফার্ম করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}