import React, { useState, useEffect } from 'react';
import { HiOutlineBuildingStorefront, HiOutlinePhoto, HiOutlineCheckBadge } from 'react-icons/hi2';

// আপনার ব্যাকএন্ডের বেস ইউআরএল (এখানে শেষের দিকে /api রাখবেন না)
const API_URL = import.meta.env.VITE_API_URL || 'https://shop-management-827d.onrender.com';

export default function ShopProfile() {
  const [shopData, setShopData] = useState({
    name: "",
    tagline: "",
    phone: "",
    email: "",
    address: "",
    tradeLicense: "",
    binNumber: "",
    tinNumber: "",
    bkashMerchant: "",
    nagadPersonal: "",
    bankDetails: "",
    invoiceFooterNote: "",
    logo: null
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const token = localStorage.getItem('token') || ''; 
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const shopId = userInfo.shopId || userInfo.id || 1; 

  useEffect(() => {
    const fetchShopProfile = async () => {
      try {
        // সঠিক ইউআরএল: /api/shops/${shopId}
        const response = await fetch(`${API_URL}/shops_profile/${shopId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setShopData({
            name: result.data.name || "",
            tagline: result.data.tagline || "",
            phone: result.data.phone || "",
            email: result.data.email || "",
            address: result.data.address || "",
            tradeLicense: result.data.tradeLicense || "",
            binNumber: result.data.binNumber || "",
            tinNumber: result.data.tinNumber || "",
            bkashMerchant: result.data.bkashMerchant || "",
            nagadPersonal: result.data.nagadPersonal || "",
            bankDetails: result.data.bankDetails || "",
            invoiceFooterNote: result.data.invoiceFooterNote || "",
            logo: result.data.logo || null
          });
        }
      } catch (error) {
        console.error("Failed to fetch shop profile:", error);
      } finally {
        setFetching(false);
      }
    };

    if (token) {
      fetchShopProfile();
    } else {
      setFetching(false);
    }
  }, [shopId, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setShopData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setShopData(prev => ({ ...prev, logo: imageUrl }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/shops_profile/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(shopData),
      });

      const result = await response.json();

      if (result.success) {
        setToast({ show: true, message: "শপ প্রোফাইল সফলভাবে আপডেট করা হয়েছে!", type: "success" });
      } else {
        setToast({ show: true, message: result.message || "আপডেট করতে সমস্যা হয়েছে!", type: "error" });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setToast({ show: true, message: "সার্ভার কানেকশনে সমস্যা হয়েছে!", type: "error" });
    } finally {
      setLoading(false);
      setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* হেডার ব্যানার */}
      <div className="relative overflow-hidden bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-xs font-medium text-indigo-200">
            <HiOutlineBuildingStorefront className="text-sm" /> লোকাল বিজনেস সেটিংস
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">শপ প্রোফাইল ও ক্যাশমেমো তথ্য</h1>
          <p className="text-slate-400 text-xs max-w-xl">
            আপনার দোকানের নাম, ট্রেড লাইসেন্স, ভ্যাট/বিন নম্বর এবং পেমেন্ট মাধ্যম কনফিগার করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              সেভ হচ্ছে...
            </>
          ) : (
            <>
              <HiOutlineCheckBadge className="text-base" /> পরিবর্তনগুলো সেভ করুন
            </>
          )}
        </button>
      </div>

      {toast.show && (
        <div className={`flex items-center gap-3 p-4 border text-xs font-semibold rounded-xl shadow-xs ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* লোগো সেকশন */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center relative group">
            <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center justify-center gap-1.5">
              <HiOutlinePhoto className="text-indigo-600 text-sm" /> দোকানের লোগো
            </h3>
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden group-hover:border-indigo-400 transition-all">
              {shopData.logo ? (
                <img src={shopData.logo} alt="Shop Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-2">
                  <span className="text-3xl">🏪</span>
                  <span className="block text-[10px] font-semibold text-slate-400 mt-1">লোগো আপলোড</span>
                </div>
              )}
              <label className="absolute inset-0 bg-slate-900/60 text-white text-xs font-semibold flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer gap-1">
                <span>📁 পরিবর্তন করুন</span>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* ইনপুট ফিল্ডস */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ১. সাধারণ তথ্য */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b pb-2">১. সাধারণ তথ্য (General Information)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">দোকানের নাম</label>
                <input
                  type="text"
                  name="name"
                  value={shopData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ট্যাগলাইন / ক্যাটাগরি</label>
                <input
                  type="text"
                  name="tagline"
                  value={shopData.tagline}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">হটলাইন / মোবাইল নম্বর</label>
                <input
                  type="text"
                  name="phone"
                  value={shopData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ইমেল অ্যাড্রেস</label>
                <input
                  type="email"
                  name="email"
                  value={shopData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">দোকানের পূর্ণাঙ্গ ঠিকানা</label>
              <textarea
                name="address"
                rows="2"
                value={shopData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none resize-none"
              ></textarea>
            </div>
          </div>

          {/* ২. লিগ্যাল ও ট্যাক্স তথ্য */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b pb-2">২. লিগ্যাল ও ট্যাক্স তথ্য (Legal & Tax)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ট্রেড লাইসেন্স নং</label>
                <input
                  type="text"
                  name="tradeLicense"
                  value={shopData.tradeLicense}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ভ্যাট / BIN নম্বর</label>
                <input
                  type="text"
                  name="binNumber"
                  value={shopData.binNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TIN নম্বর</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={shopData.tinNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* ৩. পেমেন্ট মাধ্যম */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b pb-2">৩. মার্চেন্ট ও পেমেন্ট মাধ্যম</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">বিকাশ মার্চেন্ট নম্বর</label>
                <input
                  type="text"
                  name="bkashMerchant"
                  value={shopData.bkashMerchant}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">নগদ নম্বর</label>
                <input
                  type="text"
                  name="nagadPersonal"
                  value={shopData.nagadPersonal}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* ৪. ক্যাশমেমো শর্তাবলী */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b pb-2">৪. ক্যাশমেমো শর্তাবলী</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">মেমোর নিচে প্রিন্ট হওয়ার বার্তা</label>
              <input
                type="text"
                name="invoiceFooterNote"
                value={shopData.invoiceFooterNote}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/50 focus:bg-white"
              />
            </div>
          </div>

        </div>

      </form>
    </div>
  );
}