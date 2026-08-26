import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiTrash2,
  FiPackage,
  FiBox,
  FiCheckCircle,
  FiSearch,
  FiLoader,
  FiZap,
} from "react-icons/fi";

const ProductEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Main Form State (same shape as ProductEntry)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    brand: "",
    sku: "",
    barcode: "",
    expireDate: "",
    inventoryType: "standard", // 'standard' or 'pack'
    baseUnit: "Kg",
    description: "",
  });

  // Existing Categories State (same searchable-dropdown behaviour as ProductEntry)
  const [existingCategories, setExistingCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryBoxRef = useRef(null); // dropdown এর বাইরে ক্লিক ধরার জন্য

  // Standard Product State
  const [standardData, setStandardData] = useState({
    purchasePrice: "",
    sellingPrice: "",
    stock: "",
  });

  // Pack Product State
  const [packs, setPacks] = useState([
    {
      id: 1,
      packName: "",
      multiplier: "",
      stock: "",
      purchasePrice: "",
      sellingPrice: "",
    },
  ]);

  // কাস্টম ফিল্ডের স্টেট (ProductEntry-এর সাথে মিলিয়ে)
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const shopId = user.shopId;

  // --- 1. Fetch Existing Categories (same as ProductEntry) ---
  useEffect(() => {
    const fetchCategories = async () => {
      if (!token || !shopId) return;

      setCategoryLoading(true);
      try {
        const response = await fetch(`${API_URL}/categories?shopId=${shopId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (response.ok) {
          const catList = Array.isArray(data)
            ? data.map((cat) => (typeof cat === "string" ? cat : cat.name))
            : data.categories || [];
          setExistingCategories(catList);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setCategoryLoading(false);
      }
    };

    fetchCategories();
  }, [API_URL, token, shopId]);

  // --- 2. Fetch Custom Field Config (same as ProductEntry) ---
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await fetch(`${API_URL}/fields`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          setCustomFieldsConfig(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching custom fields config:", error);
      }
    };

    fetchCustomFields();
  }, []);

  const handleCustomFieldChange = (fieldName, value) => {
    setCustomFieldValues({
      ...customFieldValues,
      [fieldName]: value,
    });
  };

  // --- 3. Fetch Existing Product Data ---
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!token || !id) return;
      try {
        const response = await fetch(`${API_URL}/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (response.ok) {
          const product = data.product || data;
          const categoryName = product.category?.name || product.category || "";

          setFormData({
            name: product.name || "",
            category: categoryName,
            brand: product.brand || "",
            sku: product.sku || "",
            barcode: product.barcode || "",
            expireDate: product.expireDate
              ? product.expireDate.substring(0, 10)
              : "",
            inventoryType: product.inventoryType || "standard",
            baseUnit: product.baseUnit || "Kg",
            description: product.description || "",
          });
          setCategoryInput(categoryName);

          // প্রোডাক্টের বিদ্যমান কাস্টম ফিল্ড ভ্যালু দিয়ে ফর্ম প্রি-ফিল করা
          if (product.customFields && typeof product.customFields === "object") {
            setCustomFieldValues(product.customFields);
          }

          if (product.inventoryType === "standard" || !product.inventoryType) {
            setStandardData({
              purchasePrice: product.purchasePrice ?? "",
              sellingPrice: product.sellingPrice ?? "",
              stock: product.quantity ?? product.stock ?? "",
            });
          } else if (product.inventoryType === "pack" && product.packs) {
            setPacks(
              product.packs.map((p, index) => ({
                id: p.id || Date.now() + index,
                packName: p.packName || "",
                multiplier: p.multiplier || "",
                stock: p.stock ?? "",
                purchasePrice: p.purchasePrice ?? "",
                sellingPrice: p.sellingPrice ?? "",
              })),
            );
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

  // --- ক্যাটাগরি ড্রপডাউন বাইরে ক্লিক করলে বন্ধ করার জন্য ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        categoryBoxRef.current &&
        !categoryBoxRef.current.contains(event.target)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setStandardData({ ...standardData, [name]: value });
  };

  // Category Selection Handlers (same as ProductEntry)
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

  // Dynamic Quick Pack Templates based on Base Unit (same as ProductEntry)
  const addQuickPack = (multiplierValue) => {
    let defaultName = `${multiplierValue} ${formData.baseUnit} প্যাক`;
    if (formData.baseUnit === "Kg")
      defaultName = `${multiplierValue} কেজি বস্তা`;
    else if (formData.baseUnit === "Pcs")
      defaultName = `${multiplierValue} পিসের বক্স`;
    else if (formData.baseUnit === "Liter")
      defaultName = `${multiplierValue} লিটার জার`;

    const exists = packs.some(
      (p) => Number(p.multiplier) === Number(multiplierValue),
    );
    if (exists) {
      alert("এই প্যাকটি ইতিমধ্যে লিস্টে যোগ করা হয়েছে!");
      return;
    }
    setPacks([
      ...packs,
      {
        id: Date.now(),
        packName: defaultName,
        multiplier: multiplierValue,
        stock: "",
        purchasePrice: "",
        sellingPrice: "",
      },
    ]);
  };

  // Pack Management Handlers (id-based, matching ProductEntry)
  const handlePackChange = (id, field, value) => {
    setPacks(
      packs.map((pack) =>
        pack.id === id ? { ...pack, [field]: value } : pack,
      ),
    );
  };

  const addPackRow = () => {
    setPacks([
      ...packs,
      {
        id: Date.now(),
        packName: "",
        multiplier: "",
        stock: "",
        purchasePrice: "",
        sellingPrice: "",
      },
    ]);
  };

  const removePackRow = (id) => {
    if (packs.length === 1) {
      alert("অন্তত একটি প্যাক কনফিগারেশন থাকা আবশ্যক!");
      return;
    }
    setPacks(packs.filter((pack) => pack.id !== id));
  };

  const filteredCategories = existingCategories.filter((cat) =>
    cat.toLowerCase().includes(categoryInput.toLowerCase()),
  );

  // --- 4. Update Product API Call ---
  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!formData.category) {
      alert("দয়া করে ক্যাটাগরি সিলেক্ট বা টাইপ করুন!");
      return;
    }

    if (!token) {
      alert("অনুমোদিত নয়: কোনো টোকেন পাওয়া যায়নি। দয়া করে আবার লগইন করুন।");
      return;
    }

    const finalPayload = {
      ...formData,
      ...(formData.inventoryType === "standard"
        ? {
            standardData,
            purchasePrice: Number(standardData.purchasePrice),
            sellingPrice: Number(standardData.sellingPrice),
            quantity: Number(standardData.stock),
            stock: Number(standardData.stock),
          }
        : { packs }),
      customFields: customFieldValues, // 👈 ProductEntry-এর মতো এখন এটাও আপডেট পেলোডে যাচ্ছে
    };

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(finalPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "পণ্য আপডেট করতে ব্যর্থ হয়েছে!");
      }

      alert("পণ্য সফলভাবে আপডেট করা হয়েছে! ✅");
      navigate("/inventory");
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
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Header (same gradient family as ProductEntry) */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 p-6 md:p-8 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <FiPackage className="text-indigo-200" size={24} />
            </div>
            পণ্য এডিট করুন (Edit Product)
          </h1>
          <p className="text-indigo-100 text-sm mt-1.5 opacity-90">
            পণ্যের তথ্য, স্টক এবং প্রাইসিং পরিবর্তন ও আপডেট করুন।
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleUpdate} className="p-6 md:p-8 space-y-6">
          {/* Section 1: Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                পণ্যের নাম (Product Name) *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="যেমন: মিনিকেট চাল, সাবান, তেল"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
              />
            </div>

            {/* Dynamic Searchable Category Input */}
            <div className="relative" ref={categoryBoxRef}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ক্যাটাগরি (Category) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={categoryInput}
                  onChange={(e) => {
                    handleCategoryInput(e);
                    setShowCategoryDropdown(true);
                  }}
                  onClick={() => setShowCategoryDropdown(true)}
                  placeholder={
                    categoryLoading
                      ? "ক্যাটাগরি লোড হচ্ছে..."
                      : "সিলেক্ট করুন অথবা নতুন টাইপ করুন..."
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
                />
                <FiSearch
                  className="absolute right-4 top-3.5 text-slate-400"
                  size={18}
                />
              </div>

              {showCategoryDropdown && (
                <div className="absolute z-20 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-50">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((cat, index) => (
                      <div
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCategory(cat);
                        }}
                        className="px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition font-medium"
                      >
                        {cat}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-indigo-600 font-semibold bg-indigo-50/60">
                      ✨ নতুন ক্যাটাগরি তৈরি হবে: "{categoryInput}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Brand Name Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ব্র্যান্ডের নাম (Brand Name){" "}
                <span className="text-xs font-normal text-slate-400">(ঐচ্ছিক)</span>
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand || ""}
                onChange={handleInputChange}
                placeholder="যেমন: ACI, Square, Pran"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
              />
            </div>

            {/* SKU Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                এসকেইউ (SKU / Product Code){" "}
                <span className="text-xs font-normal text-slate-400">(ঐচ্ছিক)</span>
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku || ""}
                onChange={handleInputChange}
                placeholder="যেমন: PRD-001"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
              />
            </div>

            {/* Barcode Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                বারকোড (Barcode){" "}
                <span className="text-xs font-normal text-slate-400">(ঐচ্ছিক)</span>
              </label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode || ""}
                onChange={handleInputChange}
                placeholder="বারকোড স্ক্যান করুন বা লিখুন..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
              />
            </div>

            {/* Expire Date Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                মেয়াদ উত্তীর্ণের তারিখ (Expire Date){" "}
                <span className="text-xs font-normal text-slate-400">(ঐচ্ছিক)</span>
              </label>
              <input
                type="date"
                name="expireDate"
                value={formData.expireDate || ""}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              সংক্ষিপ্ত বিবরণ{" "}
              <span className="text-xs font-normal text-slate-400">(ঐচ্ছিক)</span>
            </label>
            <textarea
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="পণ্য সম্পর্কে কোনো নোট বা বিশেষ বিবরণ..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50 hover:bg-white text-slate-800 text-sm"
            />
          </div>

          {/* --- ডাইনামিক কাস্টম ফিল্ড সেকশন (ProductEntry-এর সাথে মিলিয়ে) --- */}
          {customFieldsConfig.length > 0 && (
            <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 space-y-4 my-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                <span>⚙️</span> অতিরিক্ত বা কাস্টম তথ্যাবলী
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFieldsConfig.map((field) => (
                  <div key={field.fieldName}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {field.fieldLabel} {field.isRequired && <span className="text-rose-500">*</span>}
                    </label>

                    {field.fieldType === "SELECT" ? (
                      <select
                        value={customFieldValues[field.fieldName] || ""}
                        onChange={(e) => handleCustomFieldChange(field.fieldName, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 text-sm"
                        required={field.isRequired}
                      >
                        <option value="">সিলেক্ট করুন</option>
                        {field.options &&
                          field.options.split(",").map((opt, i) => (
                            <option key={i} value={opt.trim()}>
                              {opt.trim()}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type={
                          field.fieldType === "NUMBER"
                            ? "number"
                            : field.fieldType === "DATE"
                              ? "date"
                              : "text"
                        }
                        placeholder={`${field.fieldLabel} লিখুন`}
                        value={customFieldValues[field.fieldName] || ""}
                        onChange={(e) => handleCustomFieldChange(field.fieldName, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 text-sm"
                        required={field.isRequired}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Inventory Type Selector Cards */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              ইনভেন্টরি টাইপ (Inventory Type) *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() =>
                  setFormData({ ...formData, inventoryType: "standard" })
                }
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                  formData.inventoryType === "standard"
                    ? "border-indigo-600 bg-indigo-50/40 shadow-md shadow-indigo-100"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`p-3 rounded-xl ${formData.inventoryType === "standard" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-600"}`}
                >
                  <FiBox size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    সাধারণ পণ্য (Standard Product)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    একক হিসেবে বিক্রি হয় এমন পণ্য (যেমন: সাবান, প্রসাধন)
                  </p>
                </div>
              </div>

              <div
                onClick={() =>
                  setFormData({ ...formData, inventoryType: "pack" })
                }
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                  formData.inventoryType === "pack"
                    ? "border-indigo-600 bg-indigo-50/40 shadow-md shadow-indigo-100"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`p-3 rounded-xl ${formData.inventoryType === "pack" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-600"}`}
                >
                  <FiPackage size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    প্যাক বা বস্তাভিত্তিক (Pack / Multi-unit)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    বস্তা, কার্টুন বা বিভিন্ন মাপে বিক্রি হয় (যেমন: চাল, ডাল,
                    পেপসি)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Base Unit Setting (full option list, matching ProductEntry) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              বেস ইউনিট (Base Unit){" "}
              <span className="text-xs font-normal text-slate-500">
                — সিস্টেমে পরিমাপের সবচেয়ে ছোট একক
              </span>
            </label>
            <select
              name="baseUnit"
              value={formData.baseUnit}
              onChange={handleInputChange}
              className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 font-medium text-slate-800"
            >
              <optgroup label="ওজনভিত্তিক (Weight-based)">
                <option value="Kg">Kg (কিলোগ্রাম)</option>
                <option value="Gram">Gram (গ্রাম)</option>
                <option value="Mon">Mon (মণ)</option>
              </optgroup>
              <optgroup label="সাধারণ / পিস ভিত্তিক (General)">
                <option value="Pcs">Pcs (পিস)</option>
                <option value="Pair">Pair (যোড়া)</option>
                <option value="Dozen">Dozen (হালি/ডজন)</option>
              </optgroup>
              <optgroup label="তরল (Liquid-based)">
                <option value="Liter">Liter (লিটার)</option>
                <option value="Ml">Ml (মিলি লিটার)</option>
              </optgroup>
              <optgroup label="প্যাকেট / বাক্স (Pack/Box)">
                <option value="Packet">Packet (প্যাকেট)</option>
                <option value="Box">Box (বক্স)</option>
                <option value="Bottle">Bottle (বতল)</option>
              </optgroup>
            </select>
          </div>

          <hr className="border-slate-100 my-4" />

          {/* CONDITIONAL RENDER 1: Standard Product Inputs */}
          {formData.inventoryType === "standard" && (
            <div className="bg-slate-50/80 p-5 md:p-6 rounded-2xl border border-slate-200/80 space-y-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-indigo-900">
                মূল্য এবং প্রারম্ভিক স্টক
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    ক্রয়মূল্য (Purchase Price ৳)
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={standardData.purchasePrice}
                    onChange={handleStandardChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    বিক্রয়মূল্য (Selling Price ৳)
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={standardData.sellingPrice}
                    onChange={handleStandardChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    বর্তমান স্টক ({formData.baseUnit})
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={standardData.stock}
                    onChange={handleStandardChange}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CONDITIONAL RENDER 2: Pack Product Multiplier Table with Stock (same table layout as ProductEntry) */}
          {formData.inventoryType === "pack" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    প্যাক বা বস্তা কনফিগারেশন ও স্টক
                  </h3>
                  <p className="text-xs text-slate-500">
                    বেস ইউনিট ({formData.baseUnit})-এর সাপেক্ষে প্রতি প্যাকের
                    পরিমাণ এবং বর্তমানে কত বস্তা/কার্টুন স্টক আছে দিন।
                  </p>
                </div>

                {/* Dynamic Quick Selection Buttons based on Unit */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <FiZap size={12} /> শর্টকাট:
                  </span>
                  <button
                    type="button"
                    onClick={() => addQuickPack(5)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition"
                  >
                    + ৫ {formData.baseUnit}
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickPack(10)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition"
                  >
                    + ১০ {formData.baseUnit}
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickPack(25)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition"
                  >
                    + ২৫ {formData.baseUnit}
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuickPack(50)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition"
                  >
                    + ৫০ {formData.baseUnit}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                      <th className="p-3.5">
                        প্যাকের নাম (যেমন: ২৫ কেজি বস্তা)
                      </th>
                      <th className="p-3.5">কত গুণ ({formData.baseUnit})?</th>
                      <th className="p-3.5">স্টক (কয় বস্তা/কার্টুন?)</th>
                      <th className="p-3.5">ক্রয়মূল্য (৳)</th>
                      <th className="p-3.5">বিক্রয়মূল্য (৳)</th>
                      <th className="p-3.5 text-center">মুছে ফেলুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packs.map((pack) => (
                      <tr
                        key={pack.id}
                        className="text-sm hover:bg-slate-50/40 transition"
                      >
                        <td className="p-3">
                          <input
                            type="text"
                            value={pack.packName}
                            onChange={(e) =>
                              handlePackChange(
                                pack.id,
                                "packName",
                                e.target.value,
                              )
                            }
                            placeholder="যেমন: ২৫ কেজি বস্তা"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                            required
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={pack.multiplier}
                              onChange={(e) =>
                                handlePackChange(
                                  pack.id,
                                  "multiplier",
                                  e.target.value,
                                )
                              }
                              placeholder="25"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                              required
                            />
                            <span className="text-xs text-slate-400 font-bold">
                              × {formData.baseUnit}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={pack.stock}
                            onChange={(e) =>
                              handlePackChange(pack.id, "stock", e.target.value)
                            }
                            placeholder="যেমন: ৫ (বস্তা)"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 bg-amber-50/40"
                            required
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={pack.purchasePrice}
                            onChange={(e) =>
                              handlePackChange(
                                pack.id,
                                "purchasePrice",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={pack.sellingPrice}
                            onChange={(e) =>
                              handlePackChange(
                                pack.id,
                                "sellingPrice",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                            required
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => removePackRow(pack.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
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

              {/* Add Pack Row Button */}
              <button
                type="button"
                onClick={addPackRow}
                className="w-full py-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-dashed border-slate-300 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <FiPlus size={16} /> নতুন প্যাক বা সাইজ যোগ করুন
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-indigo-200 flex items-center gap-2.5 transition disabled:opacity-50"
            >
              {loading ? (
                <FiLoader className="animate-spin" size={18} />
              ) : (
                <FiCheckCircle size={18} />
              )}
              {loading ? "আপডেট করা হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন (Update Product)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductEdit;