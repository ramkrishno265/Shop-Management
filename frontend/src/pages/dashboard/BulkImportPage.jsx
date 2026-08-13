
import React, { useState } from 'react';
import { Upload, FileDown, AlertCircle, CheckCircle, X } from 'lucide-react';

const BulkImportPage = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, validating, success, error

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('ready');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Bulk Product Import</h1>
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
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium">
              Download Template
            </button>
          </div>

          {/* Upload Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-4">Step 2: Upload File</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50">
              <input type="file" className="hidden" id="fileUpload" onChange={handleFileChange} />
              <label htmlFor="fileUpload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mb-4 mx-auto" />
                <p className="font-medium text-gray-700">Click to upload or drag & drop</p>
                <p className="text-sm text-gray-400 mt-1">CSV or XLSX files (max 5MB)</p>
              </label>
            </div>
            {file && (
              <div className="mt-4 flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-green-700 text-sm font-medium">Selected: {file.name}</span>
                <button onClick={() => setFile(null)} className="text-green-700 hover:text-green-900">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-3">
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition font-medium flex items-center gap-2">
              Start Import
            </button>
          </div>
        </div>

        {/* Validation Errors Example (Visible only if needed) */}
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Validation Errors found:</p>
            <ul className="text-sm list-disc pl-5 mt-1">
              <li>Row 12: Price column is empty</li>
              <li>Row 25: SKU already exists</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkImportPage;
