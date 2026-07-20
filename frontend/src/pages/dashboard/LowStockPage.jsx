import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit3, AlertTriangle, XCircle, Package } from 'lucide-react';
import axios from 'axios';

const LowStockPage = () => {
    const API_URL = "http://localhost:5000/api/products";
    
    // States
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lowProductList, setLowProductList] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, LOW, OUT

    // Modal State for Editing Stock
    const [isEditing, setIsEditing] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [newStockValue, setNewStockValue] = useState('');

    // Auth Header Helper
    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // Fetch Products on Load
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const productsRes = await axios.get(API_URL, { headers: getAuthHeader() });

                if (Array.isArray(productsRes.data)) {
                    setAllProducts(productsRes.data);

                    const lowStock = productsRes.data.filter(
                        (product) => {
                            const stock = Number(product.stock ?? product.quantity) || 0;
                            const minStock = Number(product.minStock) || 5;
                            return stock > 0 && stock <= minStock;
                        }
                    );

                    setLowProductList(lowStock);
                } else {
                    setAllProducts([]);
                    setLowProductList([]);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [API_URL]);

    // Filter Products securely
    const filteredProducts = useMemo(() => {
        if (!Array.isArray(allProducts)) return [];

        return allProducts.filter(product => {
            if (!product) return false;

            const currentStock = Number(product.stock ?? product.quantity) || 0;
            const minStock = Number(product.minStock) || 5;

            const isLowStock = currentStock > 0 && currentStock <= minStock;
            const isStockOut = currentStock === 0;
            const matchesStockCondition = isLowStock || isStockOut;

            if (!matchesStockCondition) return false;

            if (filterStatus === 'LOW' && !isLowStock) return false;
            if (filterStatus === 'OUT' && !isStockOut) return false;

            const query = (searchQuery || '').toLowerCase().trim();
            if (query === '') return true;

            const name = typeof product.name === 'string' ? product.name.toLowerCase() : '';
            const sku = typeof product.sku === 'string' ? product.sku.toLowerCase() : '';
            
            // ক্যাটাগরি অবজেক্ট বা স্ট্রিং যাই হোক হ্যান্ডেল করার জন্য
            let catStr = '';
            if (typeof product.category === 'string') {
                catStr = product.category.toLowerCase();
            } else if (product.category && typeof product.category === 'object') {
                catStr = (product.category.name || '').toLowerCase();
            }

            return name.includes(query) || sku.includes(query) || catStr.includes(query);
        });
    }, [allProducts, searchQuery, filterStatus]);

    // Handle opening the stock edit modal
    const handleOpenEdit = (product) => {
        setSelectedProduct(product);
        setNewStockValue(product.stock ?? product.quantity ?? 0);
        setIsEditing(true);
    };

    // Handle saving the updated stock value (Prevents Page Reload)
    const handleSaveStock = async (e) => {
        e.preventDefault(); 
        const updatedStock = parseInt(newStockValue, 10);

        if (isNaN(updatedStock) || updatedStock < 0) {
            alert('Please enter a valid stock quantity.');
            return;
        }

        try {
            setAllProducts(prevProducts =>
                prevProducts.map(p =>
                    (p.id === selectedProduct.id || p._id === selectedProduct._id) 
                        ? { ...p, stock: updatedStock, quantity: updatedStock } 
                        : p
                )
            );

            setIsEditing(false);
            setSelectedProduct(null);
        } catch (error) {
            console.error("Error updating stock:", error);
            alert("Failed to update stock!");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" /> Low Stock & Stock-Out Inventory
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Monitor and manage items that require immediate restock attention.
                    </p>
                </div>

                {/* Global Search Bar */}
                <div className="relative w-full md:w-80">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search all items (Name, SKU, Category)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3">
                <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        filterStatus === 'ALL'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    All Alerts
                </button>
                <button
                    onClick={() => setFilterStatus('OUT')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        filterStatus === 'OUT'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <XCircle size={16} /> Stock Out
                </button>
                <button
                    onClick={() => setFilterStatus('LOW')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        filterStatus === 'LOW'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <AlertTriangle size={16} /> Low Stock
                </button>
            </div>

            {/* Product Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider border-b border-gray-200">
                                <th className="py-3 px-4 font-semibold">Product Name</th>
                                <th className="py-3 px-4 font-semibold">SKU</th>
                                <th className="py-3 px-4 font-semibold">Category</th>
                                <th className="py-3 px-4 font-semibold">Current Stock</th>
                                <th className="py-3 px-4 font-semibold">Status</th>
                                <th className="py-3 px-4 font-semibold text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-gray-400">
                                        Loading inventory data...
                                    </td>
                                </tr>
                            ) : filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => {
                                    const currentStock = Number(product.stock ?? product.quantity) || 0;
                                    const minStock = Number(product.minStock) || 5;
                                    const isOut = currentStock === 0;

                                    // ক্যাটাগরি রেন্ডার করার সময় সেফ চেক (অবজেক্ট হলে যেন ক্র্যাশ না করে)
                                    const categoryName = typeof product.category === 'object' && product.category !== null
                                        ? (product.category.name || 'General')
                                        : (product.category || 'General');

                                    return (
                                        <tr key={product.id || product._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3.5 px-4 font-medium text-gray-900 flex items-center gap-2">
                                                <Package size={16} className="text-gray-400 flex-shrink-0" />
                                                {product.name}
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500">{product.sku || 'N/A'}</td>
                                            <td className="py-3.5 px-4 text-gray-600">{categoryName}</td>
                                            <td className="py-3.5 px-4 font-semibold">
                                                <span className={isOut ? 'text-red-600' : 'text-amber-600'}>
                                                    {currentStock} units
                                                </span>
                                                <span className="text-xs text-gray-400 block font-normal">
                                                    Min required: {minStock}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {isOut ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                        <XCircle size={12} /> Stock Out
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                                        <AlertTriangle size={12} /> Low Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => handleOpenEdit(product)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    <Edit3 size={14} /> Edit Stock
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-gray-400">
                                        No low stock or out-of-stock items match your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stock Edit Modal */}
            {isEditing && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">Update Stock Quantity</h3>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStock} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Product Name</label>
                                <p className="text-base font-medium text-gray-800 mt-0.5">{selectedProduct.name}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase">SKU / Code</label>
                                <p className="text-sm text-gray-600 mt-0.5">{selectedProduct.sku || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Stock Quantity
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={newStockValue}
                                    onChange={(e) => setNewStockValue(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LowStockPage;