import React, { useState } from 'react';
import { UserPlus, User, Phone, Mail, MapPin, RotateCcw, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // ১. useNavigate ইম্পোর্ট করুন

export default function AddCustomer() {
  const navigate = useNavigate(); // ২. হুকটি ডিক্লেয়ার করুন

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // এখানে আপনার কাস্টমার সেভ করার লজিক বা API কল হবে
    console.log('Customer Data Saved:', formData);
    
    // সফলভাবে সেভ হওয়ার পর অ্যালার্ট দিয়ে /salePage এ নিয়ে যাবে
    alert('কাস্টমার সফলভাবে সেভ হয়েছে!');
    navigate('/salePage'); 
  };

  const handleReset = () => {
    setFormData({ name: '', phone: '', email: '', address: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-100">
        
        {/* Form Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 text-blue-600 rounded-full mb-3 shadow-sm">
            <UserPlus size={28} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">নতুন কাস্টমার যোগ করুন</h2>
          <p className="text-sm text-slate-500 mt-1">দয়া করে কাস্টমারের সঠিক তথ্য দিয়ে ফর্মটি পূরণ করুন</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Name Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <User size={16} className="inline mr-1.5 text-slate-400" />
              কাস্টমারের নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="যেমন: আব্দুর রহিম"
              required
              className="w-full px-4 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <Phone size={16} className="inline mr-1.5 text-slate-400" />
              মোবাইল নাম্বার <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="যেমন: 01712345678"
              required
              className="w-full px-4 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <Mail size={16} className="inline mr-1.5 text-slate-400" />
              ইমেইল (যদি থাকে)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@gmail.com"
              className="w-full px-4 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Address Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <MapPin size={16} className="inline mr-1.5 text-slate-400" />
              ঠিকানা
            </label>
            <textarea
              name="address"
              rows="3"
              value={formData.address}
              onChange={handleChange}
              placeholder="গ্রাম/মহল্লা, থানা, জেলা"
              className="w-full px-4 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
            ></textarea>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-2.5 px-4 rounded-lg transition-colors border border-red-100"
            >
              <RotateCcw size={18} />
              রিফ্রেশ
            </button>
            
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold py-2.5 px-4 rounded-lg shadow-md shadow-emerald-600/20 transition-all"
            >
              <Check size={18} />
              সেভ করুন
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}