import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL;

export default function DashboardHome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayInvoicesCount: 0,
    lowStockCount: 0,
    totalProductsCount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

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

        const todayStr = new Date().toISOString().split('T')[0];
        const todaySalesList = sales.filter(s => s.createdAt && s.createdAt.startsWith(todayStr));
        const totalTodaySales = todaySalesList.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

        const lowStockList = products.filter(p => (p.quantity !== undefined ? p.quantity : p.stock) <= 5);

        setStats({
          todaySales: totalTodaySales,
          todayInvoicesCount: todaySalesList.length,
          lowStockCount: lowStockList.length,
          totalProductsCount: products.length
        });

        const formattedInvoices = sales.slice(0, 5).map(s => ({
          ...s,
          invoiceNo: s.invoiceNo || `INV-${s.id}`,
          customerName: s.customer ? s.customer.name : (s.customerName || 'Walk-in Customer'),
          customerPhone: s.customer ? s.customer.phone : (s.customerPhone || ''),
          cashierName: s.cashierName || 'Cashier',
          subTotal: s.subtotal || s.grandTotal || 0,
          discount: s.discountAmount || s.discount || 0,
          totalPayable: s.grandTotal || 0,
          paidAmount: s.paidAmount || s.grandTotal || 0,
          changeBack: s.changeAmount || s.changeBack || 0,
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

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const kpiCards = [
    { title: "Today's Sales", value: `৳ ${stats.todaySales.toLocaleString()}`, change: 'আজকের মোট বিক্রি', icon: '💰', color: 'border-green-500 bg-green-50/50' },
    { title: "Today's Invoices", value: `${stats.todayInvoicesCount} টি বিল`, change: 'আজ সম্পন্ন হয়েছে', icon: '🛍️', color: 'border-blue-500 bg-blue-50/50' },
    { title: 'Low Stock Items', value: `${stats.lowStockCount} টি প্রোডাক্ট`, change: 'দ্রুত রি-অর্ডার করুন', icon: '⚠️', color: 'border-amber-500 bg-amber-50/50' },
    { title: 'Total Products', value: `${stats.totalProductsCount} টি আইটেম`, change: 'স্টকে', icon: '📦', color: 'border-purple-500 bg-purple-50/50' },
  ];

  const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 });

  const handleDownloadPDF = () => {
    if (!currentInvoice) return;
    try {
      setDownloadingPDF(true);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // ~210 mm
      let y = 15; // Top margin

      // --- Header / Shop Info ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(shopInfo.name || "Shop Name", 15, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(shopInfo.address || "", 15, y + 6);
      doc.text(`${shopInfo.phone || ''} ${shopInfo.email ? '• ' + shopInfo.email : ''}`, 15, y + 11);

      // --- Invoice Label (Right Side) ---
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

      // Divider line
      y += 24;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);

      // --- Billed to & Served by ---
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

      // --- Table Header ---
      y += 12;
      doc.setFillColor(15, 23, 42); // Dark slate background
      doc.rect(15, y, pageWidth - 30, 8, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Item Description", 18, y + 5.5);
      doc.text("Qty", 125, y + 5.5, { align: 'center' });
      doc.text("Unit Price", 155, y + 5.5, { align: 'right' });
      doc.text("Amount", pageWidth - 18, y + 5.5, { align: 'right' });

      // --- Table Items ---
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);

      const items = currentInvoice.items || [];
      items.forEach((item) => {
        y += 7;
        const price = item.price ?? item.unitPrice ?? 0;
        const total = item.total ?? (item.quantity * price);

        doc.text(String(item.name || item.productName || 'Product'), 18, y);
        doc.text(String(item.quantity), 125, y, { align: 'center' });
        doc.text(`Tk ${Number(price).toLocaleString()}`, 155, y, { align: 'right' });
        doc.text(`Tk ${Number(total).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });

        // Light row separator
        doc.setDrawColor(240, 240, 240);
        doc.line(15, y + 2, pageWidth - 15, y + 2);
      });

      // --- Totals Section ---
      y += 12;
      const rightX = pageWidth - 18;
      const labelX = pageWidth - 75;

      const subTotal = currentInvoice.subTotal || 0;
      const discount = currentInvoice.discount || 0;
      const totalPayable = currentInvoice.totalPayable || 0;
      const paidAmount = currentInvoice.paidAmount || 0;
      const changeBack = currentInvoice.changeBack || 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Subtotal:", labelX, y);
      doc.text(`Tk ${Number(subTotal).toLocaleString()}`, rightX, y, { align: 'right' });

      y += 6;
      doc.text("Discount:", labelX, y);
      doc.text(`- Tk ${Number(discount).toLocaleString()}`, rightX, y, { align: 'right' });

      // Total Payable Line
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

      y += 5;
      doc.text("Change Returned:", labelX, y);
      doc.text(`Tk ${Number(changeBack).toLocaleString()}`, rightX, y, { align: 'right' });

      // --- Footer Note ---
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

      // Save PDF
      const fileName = `Invoice-${currentInvoice?.invoiceNo || 'INV'}.pdf`;
      doc.save(fileName);

    } catch (err) {
      console.error('Error generating vector PDF:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  return (
    <div className="p-1 text-slate-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shop Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time statistics and quick shop metrics.</p>
        </div>
        <button
          onClick={() => navigate('/salePage')}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm">
          <span>➕</span> New Sale (POS)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-2xl border-l-4 border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-md ${card.color}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1.5">{loading ? '...' : card.value}</h3>
              <p className="text-xs text-slate-400 mt-1">{card.change}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-white border border-slate-100 shadow-2xs">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800">Recent Invoices</h2>
              <button onClick={() => navigate('/sales')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View All ↗
              </button>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-10 text-center text-slate-400 text-sm">Loading invoices...</div>
              ) : recentInvoices.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">কোনো সাম্প্রতিক সেল বা ইনভয়েস পাওয়া যায়নি।</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-3 font-semibold">Invoice No</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Method</th>
                      <th className="pb-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentInvoices.map((inv, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-medium text-slate-700">{inv.invoiceNo}</td>
                        <td className="py-3.5 text-slate-600">
                          <div>{inv.customerName}</div>
                          <div className="text-[11px] text-slate-400">{inv.time}</div>
                        </td>
                        <td className="py-3.5 font-semibold text-slate-800">৳{fmt(inv.totalPayable)}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${inv.paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-pink-50 text-pink-700 border border-pink-200'}`}>
                            {inv.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => {
                              setCurrentInvoice(inv);
                              setShowDetails(true);
                            }}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium transition-colors"
                            title="View Details"
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

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Low Stock Notifications
            </h2>
            <div className="space-y-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">সব প্রোডাক্টের স্টক পর্যাপ্ত আছে! 🎉</p>
              ) : (
                lowStockProducts.map((prod, i) => (
                  <div key={i} className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{prod.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{prod.sku}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-1 rounded-lg">
                      {prod.stock}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <h3 className="text-base font-bold mb-1.5">POS Billing Active 🛍️</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              আপনার কাউন্টারটি সেলস নেওয়ার জন্য সম্পূর্ণ প্রস্তুত।
            </p>
            <div className="text-xs font-mono text-slate-500 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              Counter Status: Operational
            </div>
          </div>
        </div>
      </div>

      {/* ===================== PROFESSIONAL INVOICE MODAL ===================== */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm print:bg-white print:p-0 print:items-start">
          <div
            className="flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:max-w-none"
          >
            {/* Toolbar (hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <h2 className="text-sm font-bold text-slate-800">Invoice Preview</h2>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 print:bg-white print:overflow-visible">
              <div
                ref={invoiceContentRef}
                id="printable-invoice"
                className="bg-white mx-auto my-4 p-8 max-w-[560px] shadow-sm border border-slate-100 print:shadow-none print:border-none print:m-0 print:p-6 print:max-w-none font-[system-ui] text-slate-800"
              >
                {/* Letterhead */}
                <div className="flex items-start justify-between pb-5 border-b-2 border-slate-800">
                  <div>
                    <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-tight">
                      {shopInfo.name}
                    </h1>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed max-w-[260px]">{shopInfo.address}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{shopInfo.phone} {shopInfo.email ? `• ${shopInfo.email}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">Invoice</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{currentInvoice?.invoiceNo || "#INV-001"}</p>
                    <p className="text-[10px] text-slate-400 mt-2">Date issued</p>
                    <p className="text-[11px] font-medium text-slate-700">{currentInvoice?.date || "N/A"}</p>
                  </div>
                </div>

                {/* Bill to / Served by */}
                <div className="grid grid-cols-2 gap-4 py-5">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase mb-1">Billed to</p>
                    <p className="text-[13px] font-semibold text-slate-800">{currentInvoice?.customerName || "Walk-in Customer"}</p>
                    {currentInvoice?.customerPhone && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{currentInvoice.customerPhone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase mb-1">Served by</p>
                    <p className="text-[13px] font-semibold text-slate-800">{currentInvoice?.cashierName || "Cashier"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Payment: <span className="font-semibold text-slate-700">{currentInvoice?.paymentMethod || 'CASH'}</span>
                    </p>
                  </div>
                </div>

                {/* Items table */}
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="py-2 px-3 font-semibold rounded-l-md">Item</th>
                      <th className="py-2 px-3 font-semibold text-center">Qty</th>
                      <th className="py-2 px-3 font-semibold text-right">Unit price</th>
                      <th className="py-2 px-3 font-semibold text-right rounded-r-md">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentInvoice?.items && currentInvoice.items.length > 0 ? (
                      currentInvoice.items.map((item, index) => {
                        const price = item.price ?? item.unitPrice ?? 0;
                        const total = item.total ?? (item.quantity * price);
                        return (
                          <tr key={index}>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{item.name || item.productName || 'Product'}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">৳{fmt(price)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-800">৳{fmt(total)}</td>
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

                {/* Totals */}
                <div className="flex justify-end mt-5">
                  <div className="w-full max-w-[240px] space-y-1.5">
                    <div className="flex justify-between text-[12px] text-slate-500">
                      <span>Subtotal</span>
                      <span className="text-slate-700 font-medium">৳{fmt(currentInvoice?.subTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-slate-500">
                      <span>Discount</span>
                      <span className="text-slate-700 font-medium">− ৳{fmt(currentInvoice?.discount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[14px] font-bold text-slate-900 pt-2.5 mt-1.5 border-t-2 border-slate-800">
                      <span>Total payable</span>
                      <span>৳{fmt(currentInvoice?.totalPayable)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                      <span>Paid</span>
                      <span className="font-medium text-slate-700">৳{fmt(currentInvoice?.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Change returned</span>
                      <span className="font-medium text-emerald-600">৳{fmt(currentInvoice?.changeBack)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-6 mt-6 border-t border-dashed border-slate-300">
                  <p className="text-[12px] font-semibold text-slate-700">{shopInfo.invoiceFooterNote}</p>
                  <p className="text-[9px] text-slate-400 mt-1 tracking-wide">Software powered by Matipul POS System</p>
                </div>
              </div>
            </div>

            {/* Actions (hidden on print) */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-3.5 print:hidden shrink-0">
              <button
                onClick={() => setShowDetails(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-xs"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>⬇️</span> {downloadingPDF ? 'Generating...' : 'Download PDF'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition"
              >
                <span>🖨️</span> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}