import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    shopName: '', // 👈 ADMIN এর জন্য শপের নাম
    shopId: ''    // 👈 STAFF/MANAGER এর জন্য শপ আইডি
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      // ব্যাকএন্ডে পাঠানোর জন্য অবজেক্ট রেডি করা
      const requestData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role.toUpperCase() // ব্যাকএন্ড এনাম (Enum) এর সাথে ম্যাচ করার জন্য
      };

      // রোল অনুযায়ী ডাটা কন্ডিশনাল ট্যাগ করা
      if (formData.role === 'admin') {
        requestData.shopName = formData.shopName;
      } else {
        requestData.shopId = formData.shopId ? parseInt(formData.shopId) : null;
      }

      const response = await axios.post(`${API_URL}/auth/register`, requestData);

      console.log("Registration Success:", response.data);
      alert("Registration successful! Please sign in.");
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      <div className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-xs mx-4">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/')} className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline">
              Sign in
            </button>
          </p>
        </div>

        {/* এরর অ্যালার্ট */}
        {error && (
          <div className="mb-4 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Full name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Email address</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Role Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Workspace Role</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['admin', 'manager', 'staff'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: r })}
                  className={`flex-1 py-2 text-xs font-medium uppercase rounded-lg transition-all ${
                    formData.role === r
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 🌟 কন্ডিশনাল ইনপুট ফিল্ড (রোলের ওপর ভিত্তি করে বদলাবে) */}
          {formData.role === 'admin' ? (
            <div>
              <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">Shop Name (New Business)</label>
              <input
                type="text"
                name="shopName"
                required
                value={formData.shopName}
                onChange={handleChange}
                placeholder="Melody Housing Store"
                className="w-full px-3.5 py-2 bg-indigo-50/30 border border-indigo-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Assigned Shop ID</label>
              <input
                type="number"
                name="shopId"
                required
                value={formData.shopId}
                onChange={handleChange}
                placeholder="Enter Shop ID (e.g. 1)"
                className="w-full px-3.5 py-2 bg-emerald-50/30 border border-emerald-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          )}

          {/* Passwords */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Confirm</label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium rounded-lg text-sm shadow-xs transition-all mt-4 cursor-pointer flex items-center justify-center"
          >
            {loading ? 'Creating Account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}