import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPackage, FiBox, FiCheckCircle, FiLoader, FiTrash2, FiPlus, FiZap } from 'react-icons/fi';

const ProductEdit = () => {
  const { id } = useParams(); // URL থেকে Product ID নিচ্ছি
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Main Product State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    inventoryType: 'standard',
    baseUnit: 'Kg',
    description: '',
  });

  const [categoryInput, setCategoryInput] = useState('');
  
  // Standard Data State
  const [standardData, setStandardData] = useState({
    purchasePrice: '',
    sellingPrice: '',
    stock: '',
  });

  // Pack Data State
  const [packs, setPacks] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem("token");

  // --- 1. Fetch Existing Product Data for Editing ---
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!token || !id) return;
      try {
        const response = await fetch(`${API_URL}/products/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok) {
          const product = data.product || data;
          
          setFormData({
            name: product.name || '',
            category: product.category?.name || product.category || '',
            inventoryType: product.inventoryType || 'standard',
            baseUnit: product.baseUnit || 'Kg',
            description: product.description || '',
          });
          setCategoryInput(product.category?.name || product.category || '');

          if (product.inventoryType === 'standard') {
            setStandardData({
              purchasePrice: product.purchasePrice || '',
              sellingPrice: product.sellingPrice || '',
              stock: product.quantity || '',
            });
          } else if (product.inventoryType === 'pack' && product.packs) {
            setPacks(product.packs.map(p => ({
              id: p.id,
              packName: p.packName,
              multiplier: p.multiplier,
              stock: p.stock,
              purchasePrice: p.purchasePrice,
              sellingPrice: p.sellingPrice
            })));
          }
        }
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchProductDetails();
  }, [id, API_URL, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setStandardData({ ...standardData, [name]: value });
  };

  const handlePackChange = (index, field, value) => {
    const updatedPacks = [...packs];
    updatedPacks[index][field] = value;
    setPacks(updatedPacks);
  };

  const addPackRow = () => {
    setPacks([
      ...packs,
      { id: Date.now(), packName: '', multiplier: '', stock: '', purchasePrice: '', sellingPrice: '' }
    ]);
  };

  const removePackRow = (index) => {
    setPacks(packs.filter((_, i) => i !== index));
  };

  // --- 2. Update Product API Call (PUT / PATCH) ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!token) return;

    const finalPayload = {
      ...formData,
      ...(formData.inventoryType === 'standard' ? { standardData } : { packs })
    };

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT', // অথবা PATCH আপনার ব্যাকএন্ড রাউট অনুযায়ী
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) throw new Error('পণ্য আপডেট করতে ব্যর্থ হয়েছে!');

      alert("পণ্য সফলভাবে আপডেট করা হয়েছে! ✅");
      navigate('/inventory'); // আপডেট শেষে ইনভেন্টরি পেজে ফিরিয়ে নিয়ে যাবে
    } catch (error) {
      console.error("Error updating product:", error);
      alert("ত্রুটি: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <FiLoader className="animate-spin" size={24} /> ডেটা লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-6 md:p-8 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <FiPackage size={24} /> পণ্য এডিট করুন (Edit Product)
          </h1>
          <p className="text-indigo-100 text-sm mt-1">পণ্যের তথ্য ও স্টক পরিবর্তন করুন।</p>
        </div>

        <form onSubmit={handleUpdate} className="p-6 md:p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">পণ্যের নাম *</label>
              <input 
                type="text" 
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">ক্যাটাগরি *</label>
              <input 
                type="text" 
                value={categoryInput}
                onChange={(e) => {
                  setCategoryInput(e.target.value);
                  setFormData({ ...formData, category: e.target.value });
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Inventory Type & Stock details (Standard / Pack sections similar to Entry Page) */}
          {formData.inventoryType === 'standard' ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">স্ট্যান্ডার্ড প্রোডাক্ট প্রাইস ও স্টক</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ক্রয়মূল্য</label>
                  <input type="number" name="purchasePrice" value={standardData.purchasePrice} onChange={handleStandardChange} className="w-full p-2.5 border rounded-xl bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">বিক্রয়মূল্য</label>
                  <input type="number" name="sellingPrice" value={standardData.sellingPrice} onChange={handleStandardChange} className="w-full p-2.5 border rounded-xl bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">স্টক</label>
                  <input type="number" name="stock" value={standardData.stock} onChange={handleStandardChange} className="w-full p-2.5 border rounded-xl bg-white" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">প্যাক ও স্টক কনফিগারেশন</h3>
              {packs.map((pack, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 items-center bg-slate-50 p-3 rounded-xl border">
                  <input type="text" value={pack.packName} onChange={(e) => handlePackChange(index, 'packName', e.target.value)} placeholder="প্যাকের নাম" className="p-2 border rounded-lg text-xs bg-white" />
                  <input type="number" value={pack.multiplier} onChange={(e) => handlePackChange(index, 'multiplier', e.target.value)} placeholder="multiplier" className="p-2 border rounded-lg text-xs bg-white" />
                  <input type="number" value={pack.stock} onChange={(e) => handlePackChange(index, 'stock', e.target.value)} placeholder="স্টক" className="p-2 border rounded-lg text-xs bg-white" />
                  <input type="number" value={pack.purchasePrice} onChange={(e) => handlePackChange(index, 'purchasePrice', e.target.value)} placeholder="ক্রয়মূল্য" className="p-2 border rounded-lg text-xs bg-white" />
                  <input type="number" value={pack.sellingPrice} onChange={(e) => handlePackChange(index, 'sellingPrice', e.target.value)} placeholder="বিক্রয়মূল্য" className="p-2 border rounded-lg text-xs bg-white" />
                  <button type="button" onClick={() => removePackRow(index)} className="text-rose-500 p-2"><FiTrash2 size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={addPackRow} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">+ প্যাক যোগ করুন</button>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl flex items-center gap-2"
            >
              {loading ? <FiLoader className="animate-spin" size={18} /> : <FiCheckCircle size={18} />}
              পরিবর্তন সংরক্ষণ করুন (Update Product)
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProductEdit;