import React, { useState } from 'react';

// ডামি প্রোডাক্ট ডেটা (পরবর্তীতে ব্যাকএন্ড API থেকে আসবে)
const INITIAL_PRODUCTS = [
  { id: 1, name: 'Wireless Mouse', sku: 'MS-WRLS-01', category: 'Electronics', price: 25.99, stock: 45, status: 'In Stock' },
  { id: 2, name: 'Mechanical Keyboard', sku: 'KB-MECH-02', category: 'Electronics', price: 89.99, stock: 12, status: 'Low Stock' },
  { id: 3, name: 'Leather Wallet', sku: 'WL-LTHR-03', category: 'Accessories', price: 34.50, stock: 0, status: 'Out of Stock' },
  { id: 4, name: 'Running Shoes', sku: 'SH-RUN-04', category: 'Footwear', price: 59.99, stock: 88, status: 'In Stock' },
  { id: 5, name: 'Bluetooth Headphones', sku: 'HP-BT-05', category: 'Electronics', price: 49.99, stock: 5, status: 'Low Stock' },
];

export default function Inventory() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // ফিল্টারিং লজিক (সার্চ এবং ক্যাটাগরি অনুযায়ী)
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // স্টকের উপর ভিত্তি করে ব্যাজের কালার রিটার্ন করার ফাংশন
  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Low Stock': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Out of Stock': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ১. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your shop products, stock levels, and pricing.</p>
        </div>
        <button className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm shadow-xs transition-all cursor-pointer">
          <span>+ Add Product</span>
        </button>
      </div>

      {/* ২. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Products', value: products.length, icon: '📦', color: 'text-indigo-600' },
          { title: 'Total Stock Volume', value: products.reduce((acc, p) => acc + p.stock, 0), icon: '📊', color: 'text-emerald-600' },
          { title: 'Low Stock Items', value: products.filter(p => p.status === 'Low Stock').length, icon: '⚠️', color: 'text-amber-600' },
          { title: 'Out of Stock', value: products.filter(p => p.status === 'Out of Stock').length, icon: '🚫', color: 'text-rose-600' },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
            </div>
            <div className={`text-2xl p-2 bg-slate-50 rounded-lg ${stat.color}`}>{stat.icon}</div>
          </div>
        ))}
      </div>

      {/* ৩. FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        {/* Search Input */}
        <div className="w-full sm:flex-1 relative">
          <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>
        {/* Category Dropdown Filter */}
        <div className="w-full sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:bg-white focus:border-slate-900 transition-all cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Accessories">Accessories</option>
            <option value="Footwear">Footwear</option>
          </select>
        </div>
      </div>

      {/* ৪. DATA TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Product Info</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Price</th>
                <th className="px-6 py-3.5">Stock Quantity</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                    {/* SKU */}
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{product.sku}</td>
                    {/* Category */}
                    <td className="px-6 py-4 text-slate-500">{product.category}</td>
                    {/* Price */}
                    <td className="px-6 py-4 font-medium text-slate-900">${product.price.toFixed(2)}</td>
                    {/* Stock */}
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${product.stock <= 15 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {product.stock} units
                      </span>
                    </td>
                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium border rounded-md ${getStatusStyle(product.status)}`}>
                        {product.status}
                      </span>
                    </td>
                    {/* Action Buttons */}
                    <td className="px-6 py-4 text-right space-x-2">
                      <button className="text-xs font-medium text-indigo-600 hover:text-indigo-900 hover:underline cursor-pointer">Edit</button>
                      <button className="text-xs font-medium text-rose-600 hover:text-rose-900 hover:underline cursor-pointer">Delete</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-sm text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

