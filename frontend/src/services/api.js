import axios from 'axios';

// ব্যাকএন্ড সার্ভারের বেস URL (তোমার ব্যাকএন্ড পোর্ট অনুযায়ী আপডেট করে নিও)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: প্রতিটা রিকোয়েস্টের সাথে অটোমেটিকভাবে JWT টোকেন পাঠানো
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: গ্লোবাল এরর হ্যান্ডেলিং (যেমন: 401 হলে অটো লগআউট)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // টোকেন এক্সপায়ার হলে সেশন ক্লিয়ার করে লগইন পেজে রিডাইরেক্ট
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;