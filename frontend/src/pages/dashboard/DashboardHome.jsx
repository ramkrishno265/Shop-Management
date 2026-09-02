import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL;

export default function DashboardHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayInvoicesCount: 0,
    lowStockCount: 0,
    totalProductsCount: 0,
    expiringCount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  const [dueCustomers, setDueCustomers] = useState([]);
  const [dueSearch, setDueSearch] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [showCollectPayment, setShowCollectPayment] = useState(false);

  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const invoiceContentRef = useRef(null);
  const [shopInfo, setShopInfo] = useState({
    name: "Your Shop Name",
    address: "123, Retail Market, Dhaka, Bangladesh",
    phone: "+880 1234-567890",
    email: "info@shop.com",
    invoiceFooterNote: "Thank you for shopping with us!"
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const shopId = user.shopId;

        const headers = {
          Authorization: `Bearer ${token}`,
          ...(shopId && { 'x-shop-id': shopId })
        };

        const [salesRes, productsRes, shopRes] = await Promise.all([
          axios.get(`${API_URL}/sales`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/products`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/shops_profile/${shopId}`, { headers }).catch(() => axios.get(`${API_URL}/shops_profile`, { headers }).catch(() => ({ data: null })))
        ]);

        const sales = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data.data || []);
        const products = Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data.data || []);

        const shopDataObject = shopRes?.data?.data || shopRes?.data;
        if (shopDataObject) {
          setShopInfo(prev => ({
            ...prev,
            name: shopDataObject.name || prev.name,
            address: shopDataObject.address || prev.address,
            phone: shopDataObject.phone || prev.phone,
            email: shopDataObject.email || prev.email,
            invoiceFooterNote: shopDataObject.invoiceFooterNote || prev.invoiceFooterNote
          }));
        }

        // Today's sales
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySalesList = sales.filter(s => s.createdAt && s.createdAt.startsWith(todayStr));
        const totalTodaySales = todaySalesList.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

        // Low stock
        const lowStockList = products.filter(p => (p.quantity !== undefined ? p.quantity : p.stock) <= 5);

        // Expiring soon
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        const expiringList = products
          .map(p => {
            const rawExpiry = p.expireDate;
            if (!rawExpiry) return null;

            const expiryDate = new Date(rawExpiry);
            if (isNaN(expiryDate.getTime())) return null;

            const daysLeft = Math.ceil((expiryDate.setHours(0, 0, 0, 0) - todayDate.getTime()) / MS_PER_DAY);

            return {
              name: p.name,
              sku: p.sku || 'N/A',
              expiryDate: rawExpiry,
              daysLeft
            };
          })
          .filter(p => p !== null && p.daysLeft >= 0 && p.daysLeft <= 30)
          .sort((a, b) => a.daysLeft - b.daysLeft);

        setExpiringProducts(expiringList.slice(0, 3));

        setStats({
          todaySales: totalTodaySales,
          todayInvoicesCount: todaySalesList.length,
          lowStockCount: lowStockList.length,
          totalProductsCount: products.length,
          expiringCount: expiringList.length
        });

        const formattedInvoices = sales.slice(0, 5).map(s => ({
          ...s,
          invoiceNo: s.invoiceNo || `INV-${s.id}`,
          customerName: s.customer ? s.customer.name : (s.customerName || 'Walk-in Customer'),
          customerPhone: s.customer ? s.customer.phone : (s.customerPhone || ''),
          cashierName: s.cashierName || 'Cashier',
          subTotal: s.subtotal ?? s.grandTotal ?? 0,
          discount: s.discountAmount ?? s.discount ?? 0,
          totalPayable: s.grandTotal || 0,
          productName: s.productName || 'N/A',
          paidAmount: s.paidAmount ?? 0,
          dueAmount: s.dueAmount ?? 0,
          changeBack: s.changeAmount ?? s.changeBack ?? 0,
          paymentMethod: s.paymentMethod || 'CASH',
          items: s.saleItems || s.items || s.orderItems || [],
          time: s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          date: s.createdAt ? new Date(s.createdAt).toLocaleString() : ''
        }));

        setRecentInvoices(formattedInvoices);

        const formattedLowStock = lowStockList.slice(0, 5).map(p => ({
          name: p.name,
          sku: p.sku || 'N/A',
          stock: `${p.quantity !== undefined ? p.quantity : p.stock} পিস`
        }));

        setLowStockProducts(formattedLowStock);

        // Due customers logic
        const dueMap = {};
        sales.forEach(s => {
          const due = Number(s.dueAmount) || 0;
          if (due <= 0) return;

          const custId = s.customerId || s.customer?.id || s.customerName || 'walkin';
          const custName = s.customer ? s.customer.name : (s.customerName || 'Walk-in Customer');
          const custPhone = s.customer ? s.customer.phone : (s.customerPhone || '');
          const saleDate = s.createdAt ? new Date(s.createdAt) : null;

          if (!dueMap[custId]) {
            dueMap[custId] = {
              customerName: custName,
              phone: custPhone,
              dueAmount: 0,
              lastPaymentDate: null,
              _lastPaymentDateObj: null,
              _oldestDueDateObj: saleDate
            };
          }

          const entry = dueMap[custId];
          entry.dueAmount += due;

          if (saleDate && (!entry._oldestDueDateObj || saleDate < entry._oldestDueDateObj)) {
            entry._oldestDueDateObj = saleDate;
          }

          if ((Number(s.paidAmount) || 0) > 0 && saleDate) {
            if (!entry._lastPaymentDateObj || saleDate > entry._lastPaymentDateObj) {
              entry._lastPaymentDateObj = saleDate;
              entry.lastPaymentDate = saleDate.toLocaleDateString('en-GB');
            }
          }
        });

        const dueList = Object.values(dueMap)
          .map(c => {
            const daysOverdue = c._oldestDueDateObj
              ? Math.max(0, Math.floor((todayDate.getTime() - new Date(c._oldestDueDateObj).setHours(0, 0, 0, 0)) / MS_PER_DAY))
              : 0;
            return {
              customerName: c.customerName,
              phone: c.phone,
              dueAmount: c.dueAmount,
              lastPaymentDate: c.lastPaymentDate,
              daysOverdue
            };
          })
          .sort((a, b) => b.dueAmount - a.dueAmount);

        setDueCustomers(dueList);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const kpiCards = [
    { 
      title: "Today's Sales", 
      value: `৳ ${stats.todaySales.toLocaleString()}`, 
      change: 'আজকের মোট বিক্রি', 
      icon: '💰', 
      iconBg: 'bg-emerald-500/10 text-emerald-600',
      badge: 'Real-time'
    },
    { 
      title: "Today's Invoices", 
      value: `${stats.todayInvoicesCount} টি`, 
      change: 'আজ সম্পন্ন হয়েছে', 
      icon: '🛍️', 
      iconBg: 'bg-blue-500/10 text-blue-600',
      badge: 'Orders'
    },
    { 
      title: 'Low Stock Items', 
      value: `${stats.lowStockCount} টি`, 
      change: 'দ্রুত রি-অর্ডার প্রয়োজন', 
      icon: '⚠️', 
      iconBg: 'bg-amber-500/10 text-amber-600',
      badge: 'Alert'
    },
    { 
      title: 'Total Products', 
      value: `${stats.totalProductsCount} টি`, 
      change: 'মোট আইটেম স্টকে', 
      icon: '📦', 
      iconBg: 'bg-indigo-500/10 text-indigo-600',
      badge: 'Inventory'
    },
  ];

  const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 });

  const getBalance = (inv) => {
    const paid = Number(inv?.paidAmount) || 0;
    const payable = Number(inv?.totalPayable) || 0;
    return paid - payable;
  };

  const filteredDueCustomers = dueSearch.trim()
    ? dueCustomers.filter(c => {
        const q = dueSearch.trim().toLowerCase();
        return (
          (c.customerName || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(dueSearch.trim())
        );
      })
    : dueCustomers.slice(0, 5);

  const handleDownloadPDF = () => {
    if (!currentInvoice) return;
    try {
      setDownloadingPDF(true);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(shopInfo.name || "Shop Name", 15, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(shopInfo.address || "", 15, y + 6);
      doc.text(`${shopInfo.phone || ''} ${shopInfo.email ? '• ' + shopInfo.email : ''}`, 15, y + 11);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("INVOICE", pageWidth - 15, y, { align: 'right' });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(currentInvoice.invoiceNo || "#INV-001", pageWidth - 15, y + 6, { align: 'right' });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("Date issued", pageWidth - 15, y + 12, { align: 'right' });
      doc.setTextColor(50, 50, 50);
      doc.text(currentInvoice.date || "N/A", pageWidth - 15, y + 17, { align: 'right' });

      y += 24;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);

      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("BILLED TO", 15, y);
      doc.text("SERVED BY", pageWidth / 2 + 10, y);

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(currentInvoice.customerName || "Walk-in Customer", 15, y);
      doc.text(currentInvoice.cashierName || "Cashier", pageWidth / 2 + 10, y);

      if (currentInvoice.customerPhone) {
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(currentInvoice.customerPhone, 15, y);
      }

      y += 12;
      doc.setFillColor(15, 23, 42);
      doc.rect(15, y, pageWidth - 30, 8, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Item Description", 18, y + 5.5);
      doc.text("Qty", 125, y + 5.5, { align: 'center' });
      doc.text("Unit Price", 155, y + 5.5, { align: 'right' });
      doc.text("Amount", pageWidth - 18, y + 5.5, { align: 'right' });

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);

      const items = currentInvoice.items || [];
      items.forEach((item) => {
        y += 7;
        const price = item.price ?? item.unitPrice ?? 0;
        const total = item.total ?? (item.quantity * price);

        doc.text(String(item.name || item.productName || item.product?.name || 'Product'), 18, y);
        doc.text(String(item.quantity), 125, y, { align: 'center' });
        doc.text(`Tk ${Number(price).toLocaleString()}`, 155, y, { align: 'right' });
        doc.text(`Tk ${Number(total).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(15, y + 2, pageWidth - 15, y + 2);
      });

      y += 12;
      const rightX = pageWidth - 18;
      const labelX = pageWidth - 75;

      const subTotal = currentInvoice.subTotal || 0;
      const discount = currentInvoice.discount || 0;
      const totalPayable = currentInvoice.totalPayable || 0;
      const paidAmount = currentInvoice.paidAmount || 0;
      const balance = getBalance(currentInvoice);
      const isDue = balance < 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Subtotal:", labelX, y);
      doc.text(`Tk ${Number(subTotal).toLocaleString()}`, rightX, y, { align: 'right' });

      y += 6;
      doc.text("Discount:", labelX, y);
      doc.text(`- Tk ${Number(discount).toLocaleString()}`, rightX, y, { align: 'right' });

      y += 6;
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.line(labelX - 10, y, rightX, y);

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("Total Payable:", labelX, y);
      doc.text(`Tk ${Number(totalPayable).toLocaleString()}`, rightX, y, { align: 'right' });

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Paid Amount:", labelX, y);
      doc.text(`Tk ${Number(paidAmount).toLocaleString()}`, rightX, y, { align: 'right' });

      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      if (isDue) {
        doc.setTextColor(200, 30, 30);
        doc.text("Due:", labelX, y);
        doc.text(`Tk ${Number(Math.abs(balance)).toLocaleString()}`, rightX, y, { align: 'right' });
      } else {
        doc.setTextColor(20, 120, 80);
        doc.text("Change Returned:", labelX, y);
        doc.text(`Tk ${Number(balance).toLocaleString()}`, rightX, y, { align: 'right' });
      }

      y += 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(shopInfo.invoiceFooterNote || "Thank you for shopping with us!", pageWidth / 2, y, { align: 'center' });

      y += 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Software powered by Matipul POS System", pageWidth / 2, y, { align: 'center' });

      const fileName = `Invoice-${currentInvoice?.invoiceNo || 'INV'}.pdf`;
      doc.save(fileName);

    } catch (err) {
      console.error('Error generating vector PDF:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const renderInvoiceBody = () => {
    const balance = getBalance(currentInvoice);
    const isDue = balance < 0;

    return (
      <>
        {/* Letterhead */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
              {shopInfo.name}
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-[280px]">{shopInfo.address}</p>
            <p className="text-xs text-slate-500 mt-0.5">{shopInfo.phone} {shopInfo.email ? `• ${shopInfo.email}` : ''}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 mb-1">
              Invoice
            </span>
            <p className="text-base font-bold text-slate-900">{currentInvoice?.invoiceNo || "#INV-001"}</p>
            <p className="text-[11px] text-slate-400 mt-1">Date: <span className="text-slate-700 font-medium">{currentInvoice?.date || "N/A"}</span></p>
          </div>
        </div>

        {/* Bill to / Served by */}
        <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">Billed to</p>
            <p className="text-sm font-semibold text-slate-800">{currentInvoice?.customerName || "Walk-in Customer"}</p>
            {currentInvoice?.customerPhone && (
              <p className="text-xs text-slate-500 mt-0.5">{currentInvoice.customerPhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">Served by</p>
            <p className="text-sm font-semibold text-slate-800">{currentInvoice?.cashierName || "Cashier"}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Method: <span className="font-semibold text-slate-700">{currentInvoice?.paymentMethod || 'CASH'}</span>
            </p>
          </div>
        </div>

        {/* Items table */}
        <div className="py-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-2 font-semibold">Item</th>
                <th className="py-2.5 px-2 font-semibold text-center">Qty</th>
                <th className="py-2.5 px-2 font-semibold text-right">Unit Price</th>
                <th className="py-2.5 px-2 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentInvoice?.items && currentInvoice.items.length > 0 ? (
                currentInvoice.items.map((item, index) => {
                  const price = item.price ?? item.unitPrice ?? 0;
                  const total = item.total ?? (item.quantity * price);
                  return (
                    <tr key={index}>
                      <td className="py-2.5 px-2 font-medium text-slate-800">{item.name || item.productName || item.product?.name || 'Unnamed Product'}</td>
                      <td className="py-2.5 px-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-right text-slate-600">৳{fmt(price)}</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-800">৳{fmt(total)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-400">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end pt-2">
          <div className="w-full max-w-[240px] space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span className="text-slate-700 font-medium">৳{fmt(currentInvoice?.subTotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Discount</span>
              <span className="text-slate-700 font-medium">− ৳{fmt(currentInvoice?.discount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Payable</span>
              <span>৳{fmt(currentInvoice?.totalPayable)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 pt-0.5">
              <span>Paid Amount</span>
              <span className="font-medium text-slate-700">৳{fmt(currentInvoice?.paidAmount)}</span>
            </div>
            <div className={`flex justify-between text-xs pt-1.5 border-t border-slate-100 ${isDue ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}`}>
              <span>{isDue ? 'Due Balance' : 'Change Returned'}</span>
              <span>৳{fmt(Math.abs(balance))}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 mt-6 border-t border-dashed border-slate-200">
          <p className="text-xs font-semibold text-slate-700">{shopInfo.invoiceFooterNote}</p>
          <p className="text-[10px] text-slate-400 mt-1">Software powered by Matipul POS System</p>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans text-slate-900">
      <div className=" mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Store Dashboard</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Live Overview
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Real-time statistics, retail metrics and store management.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/salePage')}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-slate-900/10 active:scale-[0.98]"
            >
              <span className="text-base leading-none">＋</span> New Sale (POS)
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, idx) => (
            <div 
              key={idx} 
              className="group bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs hover:border-slate-300 transition-all hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{card.title}</span>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold ${card.iconBg}`}>
                  {card.icon}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {loading ? (
                    <span className="inline-block w-20 h-7 bg-slate-100 rounded animate-pulse"></span>
                  ) : (
                    card.value
                  )}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-medium text-slate-400">{card.change}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Split: Left (Recent Invoices) & Right (Notifications) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Invoices Table (2 Cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Recent Transactions</h2>
                  <p className="text-xs text-slate-400 mt-0.5">সর্বশেষ সম্পন্ন হওয়া ইনভয়েসসমূহ</p>
                </div>
                <button 
                  onClick={() => navigate('/sales')} 
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                >
                  View All ↗
                </button>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">Loading invoices data...</div>
                ) : recentInvoices.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">কোনো সাম্প্রতিক সেল বা ইনভয়েস পাওয়া যায়নি।</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-5">Invoice No</th>
                        <th className="py-3 px-5">Customer</th>
                        <th className="py-3 px-5">Amount</th>
                        <th className="py-3 px-5">Method</th>
                        <th className="py-3 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentInvoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-slate-700">{inv.invoiceNo}</td>
                          <td className="py-3.5 px-5">
                            <div className="font-medium text-slate-800">{inv.customerName}</div>
                            <div className="text-[11px] text-slate-400">{inv.time}</div>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-slate-900">৳{fmt(inv.totalPayable)}</td>
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border ${
                              inv.paymentMethod === 'CASH' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                                : 'bg-pink-50 text-pink-700 border-pink-200/60'
                            }`}>
                              {inv.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => {
                                setCurrentInvoice(inv);
                                setShowDetails(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                            >
                              👁️ View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Low Stock & Alerts */}
          <div className="space-y-6">
            
            {/* Low Stock Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h2 className="text-sm font-bold text-slate-800">Low Stock Alert</h2>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  {lowStockProducts.length} Items
                </span>
              </div>

              <div className="space-y-2.5">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">সব প্রোডাক্টের স্টক পর্যাপ্ত আছে! 🎉</p>
                ) : (
                  lowStockProducts.map((prod, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-amber-50/30 transition">
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-semibold text-slate-800 truncate">{prod.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">SKU: {prod.sku}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                        {prod.stock}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expiry Alerts Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <h2 className="text-sm font-bold text-slate-800">Expiring Soon</h2>
                </div>
                <button
                  onClick={() => navigate('/expired_products')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                >
                  View All ↗
                </button>
              </div>

              <div className="space-y-2.5">
                {loading ? (
                  <p className="text-xs text-slate-400 text-center py-6">লোডিং হচ্ছে...</p>
                ) : expiringProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">কোনো পণ্যের মেয়াদ শেষের দিকে নেই! 🌿</p>
                ) : (
                  expiringProducts.map((prod, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-rose-50/30 transition">
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-semibold text-slate-800 truncate">{prod.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">মেয়াদ: {prod.expiryDate}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-rose-700 bg-rose-100/70 px-2 py-1 rounded-lg">
                        {prod.daysLeft} days left
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* System Status / Fast action card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Terminal Status</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <h3 className="text-base font-bold mt-2">POS Billing Active 🛍️</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                সেলস কাউন্টার রেডি। যেকোনো সময় দ্রুত ক্যাশ মেমো বা বিল তৈরি করতে পারেন।
              </p>
            </div>

          </div>
        </div>

        {/* Due Customers Section */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Due Accounts</h2>
                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                  {dueCustomers.length} বকেয়া
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">কাস্টমারদের বকেয়া এবং পেমেন্ট ট্র্যাকিং</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={dueSearch}
                  onChange={(e) => setDueSearch(e.target.value)}
                  placeholder="নাম বা নম্বর দিয়ে খুঁজুন..."
                  className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              </div>
              <button 
                onClick={() => navigate('/due_payment')} 
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 transition"
              >
                View All ↗
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading due customers...</div>
            ) : filteredDueCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {dueSearch.trim() ? 'কোনো মিল পাওয়া যায়নি।' : 'কোনো বকেয়া কাস্টমার পাওয়া যায়নি।'}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5">Customer</th>
                    <th className="py-3 px-5">Due Amount</th>
                    <th className="py-3 px-5">Last Payment</th>
                    <th className="py-3 px-5">Status / Overdue</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDueCustomers.map((cust, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-800">{cust.customerName}</div>
                        <div className="text-[11px] text-slate-400">{cust.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-rose-600">৳{fmt(cust.dueAmount)}</td>
                      <td className="py-3.5 px-5 text-slate-600">{cust.lastPaymentDate || '—'}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border ${
                          cust.daysOverdue > 30
                            ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                            : 'bg-amber-50 text-amber-700 border-amber-200/60'
                        }`}>
                          {cust.daysOverdue} days
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => {
                            setCurrentCustomer(cust);
                            setShowCollectPayment(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold transition"
                        >
                          💰 Collect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Invoice Modal */}
        {showDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] border border-slate-100">
              
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <h2 className="text-sm font-bold text-slate-800">Invoice Preview</h2>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              {/* Document Container */}
              <div className="flex-1 overflow-y-auto bg-slate-100/70 p-6">
                <div
                  ref={invoiceContentRef}
                  id="printable-invoice"
                  className="bg-white mx-auto p-8 max-w-[540px] rounded-xl shadow-xs border border-slate-200/60 font-sans text-slate-800"
                >
                  {renderInvoiceBody()}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 shrink-0">
                <button
                  onClick={() => setShowDetails(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <span>⬇️</span> {downloadingPDF ? 'Generating...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  <span>🖨️</span> Print Invoice
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}