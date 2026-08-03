import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPackage, FiBox, FiCheckCircle, FiLoader, FiTrash2, FiPlus } from 'react-icons/fi';

const ProductEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Main Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    inventoryType: 'standard', // 'standard' or 'pack'
    baseUnit: 'Kg',
  });

  // Standard Product State
  const [standardData, setStandardData] = useState({
    purchasePrice: '',
    sellingPrice: '',
    stock: '',
  });

  // Pack Product State
  const [packs, setPacks] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem("token");

  // --- 1. Fetch Existing Product Data ---
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
            description: product.description || '',
            inventoryType: product.inventoryType || 'standard',
            baseUnit: product.baseUnit || 'Kg',
          });

          if (product.inventoryType === 'standard') {
            setStandardData({
              purchasePrice: product.purchasePrice ?? '',
              sellingPrice: product.sellingPrice ?? '',
              stock: product.quantity ?? '',
            });
          } else if (product.inventoryType === 'pack' && product.packs) {
            setPacks(product.packs.map(p => ({
              id: p.id,
              packName: p.packName || '',
              multiplier: p.multiplier || '',
              stock: p.stock ?? '',
              purchasePrice: p.purchasePrice ?? '',
              sellingPrice: p.sellingPrice ?? ''
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

  // Handlers
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
      { packName: '', multiplier: '', stock: '', purchasePrice: '', sellingPrice: '' }
    ]);
  };

  const removePackRow = (index) => {
    setPacks(packs.filter((_, i) => i !== index));
  };

  // --- 2. Update Product API Call ---
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
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) throw new Error('পণ্য আপডেট করতে ব্যর্থ হয়েছে!');

      alert("পণ্য সফলভাবে আপডেট করা হয়েছে! ✅");
      navigate('/inventory');
    } catch (error) {
      console.error("Error updating product:", error);
      alert("ত্রুটি: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2 font-medium">
        <FiLoader className="animate-spin" size={24} /> তথ্য লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-8 font-sans flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header (Matching Entry Page) */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-6 md:p-8 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <FiPackage size={26} /> পণ্য এডিট করুন (Edit Product)
          </h1>
          <p className="text-violet-100 text-sm mt-1">
            পণ্যের তথ্য, স্টক এবং প্রাইসিং পরিবর্তন ও আপডেট করুন।
          </p>
        </div>

        <form onSubmit={handleUpdate} className="p-6 md:p-8 space-y-6">
          
          {/* Row 1: Name & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                পণ্যের নাম (Product Name) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="যেমন: মিনিকেট চাল, সাবান, তেল"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                ক্যাটাগরি (Category) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                name="category"
                required
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="ক্যাটাগরির নাম লিখুন..."
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              সংক্ষিপ্ত বিবরণ <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <textarea 
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder="পণ্য সম্পর্কে কোনো নোট বা বিশেষ বিবরণ..."
            ></textarea>
          </div>

          {/* Inventory Type Selector */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              ইনভেন্টরি টাইপ (Inventory Type) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Standard Product Option */}
              <div 
                onClick={() => setFormData({ ...formData, inventoryType: 'standard' })}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  formData.inventoryType === 'standard' 
                    ? 'border-violet-600 bg-violet-50/30 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${formData.inventoryType === 'standard' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FiBox size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">সাধারণ পণ্য (Standard Product)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">একক হিসেবে বিক্রি হয় এমন পণ্য (যেমন: সাবান, প্রসাধন)</p>
                </div>
              </div>

              {/* Pack Product Option */}
              <div 
                onClick={() => setFormData({ ...formData, inventoryType: 'pack' })}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                  formData.inventoryType === 'pack' 
                    ? 'border-violet-600 bg-violet-50/30 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${formData.inventoryType === 'pack' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FiPackage size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">প্যাক বা বস্তাভিত্তিক (Pack / Multi-unit)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">বস্তা, কার্টুন বা বিভিন্ন মাপে বিক্রি হয় (যেমন: চাল, ডাল, পেপসি)</p>
                </div>
              </div>

            </div>
          </div>

          {/* Base Unit Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              বেস ইউনিট (Base Unit) — সিস্টেমে পরিমাপের সবচেয়ে ছোট একক
            </label>
            <select 
              name="baseUnit"
              value={formData.baseUnit}
              onChange={handleInputChange}
              className="w-full md:w-1/2 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="Kg">Kg (কিলোগ্রাম)</option>
              <option value="Pcs">Pcs (পিস)</option>
              <option value="Litre">Litre (লিটার)</option>
              <option value="Gram">Gram (গ্রাম)</option>
              <option value="Packet">Packet (প্যাকেট)</option>
            </select>
          </div>

          {/* Conditional Fields: Standard vs Pack */}
          {formData.inventoryType === 'standard' ? (
            <div className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">মূল্য এবং প্রারম্ভিক স্টক</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ক্রয়মূল্য (Purchase Price)</label>
                  <input 
                    type="number" 
                    name="purchasePrice"
                    value={standardData.purchasePrice}
                    onChange={handleStandardChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-violet-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">বিক্রয়মূল্য (Selling Price)</label>
                  <input 
                    type="number" 
                    name="sellingPrice"
                    value={standardData.sellingPrice}
                    onChange={handleStandardChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-violet-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">বর্তমান স্টক ({formData.baseUnit})</label>
                  <input 
                    type="number" 
                    name="stock"
                    value={standardData.stock}
                    onChange={handleStandardChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-violet-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">প্যাক বা সাইজ অনুযায়ী স্টক এবং প্রাইসিং</h3>
                <button 
                  type="button" 
                  onClick={addPackRow}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm transition"
                >
                  <FiPlus size={14} /> আরেকটি প্যাক যোগ করুন
                </button>
              </div>

              <div className="space-y-3">
                {packs.map((pack, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">প্যাকের নাম</label>
                      <input 
                        type="text" 
                        value={pack.packName} 
                        onChange={(e) => handlePackChange(index, 'packName', e.target.value)} 
                        placeholder="যেমন: ২৫ কেজি বস্তা" 
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">গুণক (Multiplier)</label>
                      <input 
                        type="number" 
                        value={pack.multiplier} 
                        onChange={(e) => handlePackChange(index, 'multiplier', e.target.value)} 
                        placeholder="২৫" 
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">স্টক (Quantity)</label>
                      <input 
                        type="number" 
                        value={pack.stock} 
                        onChange={(e) => handlePackChange(index, 'stock', e.target.value)} 
                        placeholder="৫" 
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">ক্রয়মূল্য</label>
                      <input 
                        type="number" 
                        value={pack.purchasePrice} 
                        onChange={(e) => handlePackChange(index, 'purchasePrice', e.target.value)} 
                        placeholder="১200" 
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">বিক্রয়মূল্য</label>
                      <input 
                        type="number" 
                        value={pack.sellingPrice} 
                        onChange={(e) => handlePackChange(index, 'sellingPrice', e.target.value)} 
                        placeholder="১৩৫০" 
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium" 
                      />
                    </div>
                    <div className="flex justify-center pt-3 sm:pt-0">
                      {packs.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removePackRow(index)} 
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                          title="মুছে ফেলুন"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-violet-600/20 flex items-center gap-2.5 transition"
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