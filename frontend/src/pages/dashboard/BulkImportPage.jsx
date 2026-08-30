import React, { useState, useRef } from 'react';
import { Upload, FileDown, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const BulkImportPage = () => {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [errorDetails, setErrorDetails] = useState([]);
    const isSubmittingRef = useRef(false); // ডাবল-ক্লিক আটকানোর জন্য

    // ফাইল হ্যান্ডেল করা এবং XLSX দিয়ে পার্স করা
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setMessage('');
            setErrorDetails([]);

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target.result;
                    // ✅ cellDates: true — এক্সেলের ডেট সেলগুলো (যেমন expiryDate কলাম) সঠিক JS Date
                    // অবজেক্ট হিসেবে পার্স হবে, raw Excel serial number (যেমন 46112) হিসেবে না।
                    // এটা ছাড়া ভুল/অবাস্তব তারিখ ব্যাকএন্ডে চলে যেত।
                    const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
                    const wsname = workbook.SheetNames[0];
                    const ws = workbook.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws);
                    setParsedData(data);
                } catch (error) {
                    setMessage("Failed to read the excel file. Please use the valid template.");
                }
            };
            reader.readAsBinaryString(selectedFile);
        }
    };

    // ব্যাকএন্ডে ডেটা পাঠানো (Vite API URL, টোকেন এবং ডাইনামিক শপ আইডি সহ)
    const handleStartImport = async () => {
        // যদি আগে থেকেই একটা সাবমিট চলমান থাকে, দ্বিতীয়টা আটকে দাও
        if (isSubmittingRef.current) return;

        if (parsedData.length === 0) {
            alert("Please upload a valid Excel or CSV file first!");
            return;
        }

        isSubmittingRef.current = true; // সাথে সাথে লক করা হলো (synchronous)
        setLoading(true);
        setMessage('');
        setErrorDetails([]);

        try {
            // ১. LocalStorage থেকে টোকেন এবং ইউজার অবজেক্ট বের করা
            const token = localStorage.getItem('token');
            const userString = localStorage.getItem('user');

            let currentShopId = null;
            if (userString) {
                try {
                    const userObj = JSON.parse(userString);
                    currentShopId = userObj.shopId;
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                }
            }

            // ২. Vite এনভায়রনমেন্ট ভেরিয়েবল থেকে API_URL ব্যবহার করা
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const response = await fetch(`${API_URL}/products/bulk-import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // ব্যাকএন্ডে টোকেন ভেরিফিকেশনের জন্য
                },
                body: JSON.stringify({
                    requestShopId: currentShopId ? Number(currentShopId) : undefined, // ডাইনামিক শপ আইডি ব্যাকএন্ডে পাঠানো হলো
                    products: parsedData
                })
            });

            const result = await response.json();

            if (response.ok) {
                setMessage(`Success! Successfully imported ${result.successCount} products.`);
                if (result.failedProducts && result.failedProducts.length > 0) {
                    setErrorDetails(result.failedProducts.map(f => `Item (${f.item}): ${f.reason}`));
                }
            } else {
                setMessage(`Error: ${result.message || result.error || "Something went wrong"}`);
            }
        } catch (err) {
            setMessage("Failed to connect to server. Make sure backend is running.");
        } finally {
            setLoading(false);
            isSubmittingRef.current = false; // লক খুলে দেওয়া হলো
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Bulk Product Import (Standard & Pack)</h1>
                    <p className="text-gray-600">Upload your product list using CSV or Excel format.</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

                    {/* Instructions Section */}
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                        <div className="flex gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg">
                                <FileDown className="text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">Step 1: Download Template</h3>
                                <p className="text-sm text-gray-500">Use our pre-defined format for quick upload.</p>
                            </div>
                        </div>

                        <a
                            href="/product-template.xlsx"
                            download
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium"
                        >
                            <FileDown size={18} /> Download Template
                        </a>
                    </div>

                    {/* Upload Section */}
                    <div className="mb-8">
                        <h3 className="font-semibold text-gray-800 mb-4">Step 2: Upload File</h3>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50">
                            <input
                                type="file"
                                className="hidden"
                                id="fileUpload"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="fileUpload" className="cursor-pointer">
                                <Upload className="w-12 h-12 text-gray-400 mb-4 mx-auto" />
                                <p className="font-medium text-gray-700">Click to upload or drag & drop</p>
                                <p className="text-sm text-gray-400 mt-1">CSV or XLSX files (max 5MB)</p>
                            </label>
                        </div>

                        {file && (
                            <div className="mt-4 flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                                <span className="text-green-700 text-sm font-medium">
                                    Selected: {file.name} ({parsedData.length} items detected)
                                </span>
                                <button
                                    onClick={() => { setFile(null); setParsedData([]); }}
                                    className="text-green-700 hover:text-green-900"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Success / Status Message */}
                    {message && (
                        <div className={`mb-6 p-4 rounded-xl border ${message.includes('Success') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                            <p className="font-medium">{message}</p>
                        </div>
                    )}

                    {/* Action Footer */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => { setFile(null); setParsedData([]); setMessage(''); }}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStartImport}
                            disabled={loading || !file}
                            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? "Processing..." : "Start Import"}
                        </button>
                    </div>
                </div>

                {/* Validation Errors (Visible only if errors exist) */}
                {errorDetails.length > 0 && (
                    <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold">Validation Errors found:</p>
                            {/* ✅ errorDetails নিজেই একটা string array (উপরে setErrorDetails(...) দ্রষ্টব্য) —
                                আগে ভুল করে errorDetails.errorDetails?.map() লেখা ছিল, যেটা সবসময়
                                undefined হয়ে তালিকা খালি দেখাতো। এখন সরাসরি errorDetails.map() */}
                            <ul className="text-sm list-disc pl-5 mt-1">
                                {errorDetails.map((err, index) => (
                                    <li key={index}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkImportPage;