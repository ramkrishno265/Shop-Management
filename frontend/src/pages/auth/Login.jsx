import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // 👈 সরাসরি axios ইম্পোর্ট করো

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('admin');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // ব্যাকএন্ড URL কনফিগারেশন
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 🚀 সরাসরি ব্যাকএন্ডে POST রিকোয়েস্ট পাঠানো হচ্ছে
            const response = await axios.post(`${API_URL}/auth/login`, {
                email,
                password,
                role
            });

            const data = response.data;

            // টোকেন ও ইউজার ডেটা লোকাল স্টোরেজে সেভ করা
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', data.user.role);

            // সফল হলে ড্যাশবোর্ডে রিডাইরেক্ট
            navigate('/dashboard');
        } catch (err) {
            // সার্ভারের কাস্টম এরর মেসেজ ডিসপ্লে করা
            setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
            <div className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-xs mx-4">

                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        New to the platform?{' '}
                        <button type="button" onClick={() => navigate('/signup')} className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline">
                            Create an account
                        </button>
                    </p>
                </div>

                {/* এরর মেসেজ অ্যালার্ট */}
                {error && (
                    <div className="mb-4 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Role</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['admin', 'manager', 'staff'].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`flex-1 py-2 text-xs font-medium uppercase rounded-lg transition-all ${role === r ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Email address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
                            <a href="#" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium hover:underline">Forgot?</a>
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium rounded-lg text-sm shadow-xs transition-all mt-2 cursor-pointer flex items-center justify-center"
                    >
                        {loading ? 'Connecting...' : `Continue as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                    </button>
                </form>
            </div>
        </div>
    );
}