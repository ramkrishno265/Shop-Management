import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '', // নতুন যোগ করা হয়েছে
    password: '',
    confirmPassword: '',
    role: 'staff',
    shopName: '',
    shopId: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ভ্যালিডেশন
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      // ব্যাকএন্ডে পাঠানোর জন্য ডেটা গঠন
      const requestData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone, // ডাটাবেস স্কিমা অনুযায়ী প্রয়োজন
        password: formData.password,
        role: formData.role.toUpperCase()
      };

      if (formData.role === 'admin') {
        requestData.shopName = formData.shopName;
      } else {
        requestData.shopId = formData.shopId ? parseInt(formData.shopId) : null;
      }

      await axios.post(`${API_URL}/auth/register`, requestData);

      alert("Registration successful! Please sign in.");
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/')} className="text-indigo-600 font-medium hover:underline">
              Sign in
            </button>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Full name</label>
              <input name="name" required value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Phone</label>
              <input name="phone" required value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-slate-900 outline-none" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Email address</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-slate-900 outline-none" />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Workspace Role</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['admin', 'manager', 'staff'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, role: r }))}
                  className={`flex-1 py-2 text-xs font-medium uppercase rounded-lg transition-all ${formData.role === r ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Shop Input */}
          {formData.role === 'admin' ? (
            <div>
              <label className="block text-xs font-semibold text-indigo-600 uppercase mb-2">Shop Name</label>
              <input name="shopName" required value={formData.shopName} onChange={handleChange} className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-emerald-600 uppercase mb-2">Assigned Shop ID</label>
              <input type="number" name="shopId" required value={formData.shopId} onChange={handleChange} className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50/30 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
          )}

          {/* Passwords */}
          <div className="grid grid-cols-2 gap-4">
            <input type="password" name="password" placeholder="Password" required value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
            <input type="password" name="confirmPassword" placeholder="Confirm" required value={formData.confirmPassword} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-lg text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}