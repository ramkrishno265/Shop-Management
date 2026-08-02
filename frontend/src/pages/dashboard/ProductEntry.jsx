import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiPackage, FiBox, FiCheckCircle, FiSearch, FiLoader } from 'react-icons/fi';

const ProductEntry = () => {
  const [loading, setLoading] = useState(false);

  // Main Product State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    inventoryType: 'standard', // 'standard' or 'pack'
    baseUnit: 'Pcs',
    description: '', // ব্যাকএন্ডের সাথে সামঞ্জস্য রাখতে যোগ করা হলো
  });

  // Existing Categories State
  const [existingCategories, setExistingCategories] = useState([
    'Grocery / Rice / Oil',
    'Pharmacy / Medicine',
    'Furniture',
    'Electronics & Gadgets',
    'Fashion & Apparels',
    'Hardware & Sanitary',
    'Stationery & Books'
  ]);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // For Standard Product Pricing
  const [standardData, setStandardData] = useState({
    purchasePrice: '',
    sellingPrice: '',
    stock: '',
  });

  // For Pack Product Multipacks List
  const [packs, setPacks] = useState([
    { id: 1, packName: '25 Kg Bag', multiplier: 25, purchasePrice: '', sellingPrice: '' }
  ]);

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setStandardData({ ...standardData, [name]: value });
  };

  // Category Selection Handlers
  const selectCategory = (cat) => {
    setCategoryInput(cat);
    setFormData({ ...formData, category: cat });
    setShowCategoryDropdown(false);
  };

  const handleCategoryInput = (e) => {
    const val = e.target.value;
    setCategoryInput(val);
    setFormData({ ...formData, category: val });
    setShowCategoryDropdown(true);
  };

  // Pack Management Handlers
  const handlePackChange = (id, field, value) => {
    setPacks(packs.map(pack => pack.id === id ? { ...pack, [field]: value } : pack));
  };

  const addPackRow = () => {
    setPacks([
      ...packs,
      { id: Date.now(), packName: '', multiplier: '', purchasePrice: '', sellingPrice: '' }
    ]);
  };

  const removePackRow = (id) => {
    if (packs.length === 1) {
      alert("At least one pack configuration is required!");
      return;
    }
    setPacks(packs.filter(pack => pack.id !== id));
  };

  // --- Backend API Integration (handleSubmit) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.category) {
      alert("Please select or type a category!");
      return;
    }

    const token = localStorage.getItem("token");
    
    if (!token) {
      alert("Unauthorized: No token found. Please login again.");
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const finalPayload = {
      ...formData,
      ...(formData.inventoryType === 'standard' ? { standardData } : { packs })
    };

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save product to database!');
      }

      alert("Product saved successfully to database!");

      // Form Reset
      setFormData({
        name: '',
        category: '',
        inventoryType: 'standard',
        baseUnit: 'Pcs',
        description: '',
      });
      setCategoryInput('');
      setStandardData({ purchasePrice: '', sellingPrice: '', stock: '' });
      setPacks([{ id: 1, packName: '25 Kg Bag', multiplier: 25, purchasePrice: '', sellingPrice: '' }]);

    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter categories based on input
  const filteredCategories = existingCategories.filter(cat => 
    cat.toLowerCase().includes(categoryInput.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiPackage className="text-indigo-200" /> New Product Entry
          </h1>
          <p className="text-indigo-100 text-sm mt-1">
            Add standard items or multi-unit pack products seamlessly into your inventory.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {/* Section 1: Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Product Name *</label>
              <input 
                type="text" 
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Basmati Rice, T-Shirt, Paracetamol"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {/* Dynamic Searchable Category Input */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Category *</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={categoryInput}
                  onChange={handleCategoryInput}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Select or type new category..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
                />
                <FiSearch className="absolute right-3.5 top-3.5 text-slate-400" />
              </div>

              {/* Category Suggestions Dropdown */}
              {showCategoryDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((cat, index) => (
                      <div 
                        key={index}
                        onClick={() => selectCategory(cat)}
                        className="px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer transition border-b border-slate-50 last:border-none"
                      >
                        {cat}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2.5 text-sm text-indigo-600 font-medium bg-indigo-50/50">
                      ✨ Will create new category: "{categoryInput}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description <span className="text-xs font-normal text-slate-400">(Optional)</span></label>
            <textarea 
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Add short notes or description about the product..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          {/* Section 2: Inventory Type Selector Cards */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Inventory Type *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Standard Product Option */}
              <div 
                onClick={() => setFormData({ ...formData, inventoryType: 'standard' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  formData.inventoryType === 'standard' 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${formData.inventoryType === 'standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FiBox size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Standard Product</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Furniture, Electronics, Fashion, Hardware (Single unit selling)</p>
                </div>
              </div>

              {/* Pack Product Option */}
              <div 
                onClick={() => setFormData({ ...formData, inventoryType: 'pack' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  formData.inventoryType === 'pack' 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${formData.inventoryType === 'pack' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FiPackage size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pack Product</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Rice, Oil, Medicine, Beverages (Multi-unit & multi-pack conversion)</p>
                </div>
              </div>

            </div>
          </div>

          {/* Section 3: Base Unit Setting */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Base Unit <span className="text-xs font-normal text-slate-500">(Smallest measuring unit in system)</span>
            </label>
            <select 
              name="baseUnit"
              value={formData.baseUnit}
              onChange={handleInputChange}
              className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <optgroup label="General / Piece-based">
                <option value="Pcs">Pcs (Piece)</option>
                <option value="Pair">Pair (যোড়া)</option>
                <option value="Set">Set</option>
                <option value="Dozen">Dozen (হালি)</option>
              </optgroup>
              <optgroup label="Weight-based (Grocery)">
                <option value="Kg">Kg (Kilogram)</option>
                <option value="Gram">Gram</option>
                <option value="Mon">Mon (মণ)</option>
              </optgroup>
              <optgroup label="Liquid-based (Oil / Beverage)">
                <option value="Liter">Liter</option>
                <option value="Ml">Ml (Milliliter)</option>
              </optgroup>
              <optgroup label="Pack / Box-based (Pharmacy / FMCG)">
                <option value="Tablet">Tablet / Piece</option>
                <option value="Strip">Strip (পাতা)</option>
                <option value="Packet">Packet</option>
                <option value="Box">Box</option>
                <option value="Bottle">Bottle</option>
              </optgroup>
              <optgroup label="Length-based (Cloth / Hardware)">
                <option value="Meter">Meter</option>
                <option value="Yard">Yard (গজ)</option>
                <option value="Feet">Feet</option>
              </optgroup>
            </select>
          </div>

          <hr className="border-slate-100" />

          {/* CONDITIONAL RENDER 1: Standard Product Inputs */}
          {formData.inventoryType === 'standard' && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-indigo-900">Standard Pricing & Stock</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Price (৳)</label>
                  <input 
                    type="number" 
                    name="purchasePrice"
                    value={standardData.purchasePrice}
                    onChange={handleStandardChange}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Selling Price (৳)</label>
                  <input 
                    type="number" 
                    name="sellingPrice"
                    value={standardData.sellingPrice}
                    onChange={handleStandardChange}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Opening Stock</label>
                  <input 
                    type="number" 
                    name="stock"
                    value={standardData.stock}
                    onChange={handleStandardChange}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CONDITIONAL RENDER 2: Pack Product Multiplier Table */}
          {formData.inventoryType === 'pack' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pack / Unit Configurations</h3>
                  <p className="text-xs text-slate-500">Define packs relative to your base unit ({formData.baseUnit}).</p>
                </div>
                <button 
                  type="button"
                  onClick={addPackRow}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition"
                >
                  <FiPlus /> Add Pack Variant
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold border-b border-slate-200">
                      <th className="p-3">Pack Name (e.g., 25kg Bag / Strip)</th>
                      <th className="p-3">Multiplier (Factor)</th>
                      <th className="p-3">Purchase Price (৳)</th>
                      <th className="p-3">Selling Price (৳)</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packs.map((pack) => (
                      <tr key={pack.id} className="text-sm">
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={pack.packName}
                            onChange={(e) => handlePackChange(pack.id, 'packName', e.target.value)}
                            placeholder="e.g. 25 Kg Bag"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              value={pack.multiplier}
                              onChange={(e) => handlePackChange(pack.id, 'multiplier', e.target.value)}
                              placeholder="25"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                              required
                            />
                            <span className="text-xs text-slate-400 font-medium">× {formData.baseUnit}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" 
                            value={pack.purchasePrice}
                            onChange={(e) => handlePackChange(pack.id, 'purchasePrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" 
                            value={pack.sellingPrice}
                            onChange={(e) => handlePackChange(pack.id, 'sellingPrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                            required
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            type="button"
                            onClick={() => removePackRow(pack.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Remove Row"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? <FiLoader className="animate-spin" size={18} /> : <FiCheckCircle size={18} />}
              {loading ? 'Saving...' : 'Save Product to Inventory'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProductEntry;