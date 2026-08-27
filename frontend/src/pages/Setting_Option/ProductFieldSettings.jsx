import React, { useState, useEffect } from "react";
import { Plus, Trash2, Settings2, Lock, Type, Hash, Calendar, ChevronDown } from "lucide-react";

// এনভায়রনমেন্ট ভ্যারিয়েবল থেকে বেস ইউআরএল সেট করা
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TYPE_META = {
  text: { label: "Text", icon: Type },
  number: { label: "Number", icon: Hash },
  date: { label: "Date", icon: Calendar },
  select: { label: "Dropdown", icon: ChevronDown },
};

export default function SimpleProductFieldSettings() {
  // ইউনিভার্সাল বা ফিক্সড ফিল্ডসমূহ (যেগুলো সব শপেই সাধারণ ফিল্ড হিসেবে থাকবে)
  const coreFields = [
    { name: "name", label: "Product Name", type: "text", required: true },
    { name: "sku", label: "SKU / Product Code", type: "text", required: false },
    { name: "price", label: "Selling Price", type: "number", required: true },
    { name: "buyPrice", label: "Purchase / Cost Price", type: "number", required: false },
    { name: "stock", label: "Stock Quantity", type: "number", required: true },
    { name: "unit", label: "Unit (e.g., Pcs, Kg, Ltr)", type: "text", required: false },
    { name: "category", label: "Category", type: "text", required: false },
  ];

  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // নতুন ফিল্ড বানানোর ফর্মের স্টেট
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [newOptions, setNewOptions] = useState("");
  const [formError, setFormError] = useState("");

  // ১. পেজ লোড হওয়ার সময় ব্যাকএন্ড থেকে ফিল্ডগুলো ফেচ করা (GET)
  useEffect(() => {
    fetchShopFields();
  }, []);

  const fetchShopFields = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/fields`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const formattedFields = data.data.map((item) => ({
          fieldName: item.fieldName,
          label: item.fieldLabel,
          type: item.fieldType.toLowerCase(),
          options: Array.isArray(item.options) ? item.options.join(", ") : item.options || "",
        }));
        setCustomFields(formattedFields);
      }
    } catch (err) {
      console.error("Error fetching fields:", err);
    }
  };

  // নতুন ফিল্ড লোকাল লিস্টে যোগ করা
  const handleAdd = (e) => {
    e.preventDefault();
    setFormError("");

    if (!newLabel.trim()) {
      setFormError("ফিল্ডের নাম লিখতে হবে");
      return;
    }
    if (newType === "select" && !newOptions.trim()) {
      setFormError("ড্রপডাউনের অপশনগুলো লিখতে হবে");
      return;
    }

    const generatedFieldName = newLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "_");

    if (customFields.some((f) => f.fieldName === generatedFieldName)) {
      setFormError("এই নামের একটা ফিল্ড আগে থেকেই আছে");
      return;
    }

    const newItem = {
      fieldName: generatedFieldName,
      label: newLabel.trim(),
      type: newType,
      options: newOptions,
    };

    setCustomFields([...customFields, newItem]);
    setNewLabel("");
    setNewOptions("");
    setNewType("text");
  };

  // ফিল্ড লোকাল লিস্ট থেকে রিমুভ করা
  const handleDelete = (fieldName) => {
    setCustomFields(customFields.filter((item) => item.fieldName !== fieldName));
  };

  // ২. সার্ভারে সব ফিল্ড সেভ করা (POST / Upsert API Call)
  const handleSaveAll = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const payloadFields = customFields.map((field) => ({
        fieldName: field.fieldName,
        fieldLabel: field.label,
        fieldType: field.type.toUpperCase(),
        isRequired: false,
        options:
          field.type === "select" && field.options
            ? field.options.split(",").map((opt) => opt.trim())
            : [],
      }));

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/fields`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields: payloadFields }),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setFormError("সেভ করা যায়নি: " + data.message);
      }
    } catch (err) {
      console.error("Error saving fields:", err);
      setFormError("সমস্যা হয়েছে, আবার চেষ্টা করুন");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F5F0] flex items-start justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#1F4D3F] flex items-center justify-center flex-shrink-0">
            <Settings2 size={20} className="text-[#EFE7D8]" />
          </div>
          <div>
            <h1 className="text-[19px] font-semibold text-[#1B1B18] tracking-tight">
              প্রোডাক্ট ফিল্ড সেটিংস
            </h1>
            <p className="text-[13px] text-[#6B6A63]">
              প্রোডাক্ট যোগ করার সময় কোন কোন তথ্য নেবেন সেটা এখান থেকে ঠিক করুন
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E4E2D8] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Core / fixed fields */}
          <div className="p-6 border-b border-[#EDEBE0]">
            <div className="flex items-center gap-1.5 mb-3">
              <Lock size={12} className="text-[#9A988C]" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A988C]">
                স্ট্যান্ডার্ড ফিল্ড (সবসময় থাকবে)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {coreFields.map((field) => (
                <span
                  key={field.name}
                  className="text-[12.5px] font-medium text-[#3A3934] bg-[#F3F1E9] border border-[#E4E2D8] rounded-md px-2.5 py-1.5"
                >
                  {field.label}
                  {field.required && <span className="text-[#B5442E] ml-0.5">*</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Custom fields list */}
          <div className="p-6 bg-[#FBFAF6] border-b border-[#EDEBE0]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A988C] mb-1">
              আপনার কাস্টম ফিল্ড
            </p>
            <p className="text-[13px] text-[#8C8A7D] mb-4">
              নিজের দোকানের জন্য আলাদা কোনো তথ্য নিতে চাইলে এখানে যোগ করুন
            </p>

            {customFields.length === 0 ? (
              <div className="text-center py-6 rounded-lg border border-dashed border-[#DEDCD0] text-[13px] text-[#B0AE9F]">
                এখনো কোনো কাস্টম ফিল্ড যোগ করা হয়নি
              </div>
            ) : (
              <div className="rounded-lg border border-[#E4E2D8] bg-white overflow-hidden divide-y divide-[#EDEBE0]">
                {customFields.map((field, idx) => {
                  const meta = TYPE_META[field.type] || TYPE_META.text;
                  const Icon = meta.icon;
                  return (
                    <div key={field.fieldName} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="text-[11px] font-mono text-[#B6B4A6] w-5 flex-shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <Icon size={13} className="text-[#1F4D3F] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-[#3A3934]">
                            {field.label}
                          </span>
                          <span className="text-[11px] font-medium text-[#1F6F5C] bg-[#E1F0EA] rounded px-1.5 py-0.5">
                            {meta.label}
                          </span>
                        </div>
                        {field.options && (
                          <p className="text-[12px] text-[#8C8A7D] mt-0.5 truncate">
                            অপশন: {field.options}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(field.fieldName)}
                        aria-label="ফিল্ড ডিলিট করুন"
                        className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#B6B4A6] hover:text-[#B5442E] hover:bg-[#FBEAE6] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new field form */}
          <div className="p-6 border-b border-[#EDEBE0]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A988C] mb-4">
              নতুন ফিল্ড যোগ করুন
            </p>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-[#3A3934] mb-1.5">
                  ফিল্ডের নাম
                </label>
                <input
                  type="text"
                  placeholder="যেমন: Color, Brand, Weight, Size"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full text-[14px] rounded-lg border border-[#DEDCD0] px-3 py-2.5 outline-none focus:border-[#1F4D3F] focus:ring-2 focus:ring-[#1F4D3F]/10 transition-colors placeholder:text-[#B6B4A6]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#3A3934] mb-1.5">
                  ফিল্ডের ধরন
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(TYPE_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    const active = newType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewType(key)}
                        className={`flex items-center justify-center gap-1.5 text-[13px] font-medium rounded-lg border px-3 py-2 transition-colors ${
                          active
                            ? "bg-[#1F4D3F] border-[#1F4D3F] text-white"
                            : "bg-white border-[#DEDCD0] text-[#6B6A63] hover:border-[#1F4D3F] hover:text-[#1F4D3F]"
                        }`}
                      >
                        <Icon size={14} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {newType === "select" && (
                <div>
                  <label className="block text-[13px] font-medium text-[#3A3934] mb-1.5">
                    ড্রপডাউন অপশন (কমা দিয়ে আলাদা করুন)
                  </label>
                  <input
                    type="text"
                    placeholder="Red, Green, Blue"
                    value={newOptions}
                    onChange={(e) => setNewOptions(e.target.value)}
                    className="w-full text-[14px] rounded-lg border border-[#DEDCD0] px-3 py-2.5 outline-none focus:border-[#1F4D3F] focus:ring-2 focus:ring-[#1F4D3F]/10 transition-colors placeholder:text-[#B6B4A6]"
                  />
                </div>
              )}

              {formError && <p className="text-[12.5px] text-[#B5442E]">{formError}</p>}

              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-white bg-[#1F4D3F] rounded-lg px-4 py-2.5 hover:bg-[#183D32] transition-colors w-full sm:w-auto"
              >
                <Plus size={15} />
                লিস্টে যোগ করুন
              </button>
            </form>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between px-6 py-4 bg-white">
            <span className="text-[12px] text-[#9A988C]">
              {saved
                ? "সেভ হয়ে গেছে"
                : `${customFields.length}টি কাস্টম ফিল্ড প্রস্তুত`}
            </span>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={loading}
              className="text-[13px] font-medium text-white bg-[#1F4D3F] rounded-lg px-5 py-2 hover:bg-[#183D32] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "সেভ হচ্ছে..." : "সব পরিবর্তন সেভ করুন"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}