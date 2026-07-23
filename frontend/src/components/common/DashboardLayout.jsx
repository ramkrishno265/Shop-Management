import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user.role || "STAFF";
  const name = user.name || "Unknown";
  const shopId = user.shopId || "N/A";

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-900">

      {/* SIDEBAR */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 fixed md:sticky top-0 h-screen z-20 ${isSidebarOpen ? 'w-64' : 'w-20'
        }`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xl">🛒</span>
            {isSidebarOpen && <span className="font-bold tracking-tight text-sm">ShopManager</span>}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            {isSidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {[
            { name: 'Dashboard', icon: '📊', path: '/dashboard' },
            { name: 'Inventory', icon: '📦', path: '/inventory' },
            { name: 'Sales & Billing', icon: '💼', path: '/salePage' },
            { name: 'Staff Management', icon: '👥', path: '#' },
          ].map((item, idx) => (
            <a
              key={idx}
              href={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <span>{item.icon}</span>
              {isSidebarOpen && <span className="truncate">{item.name}</span>}
            </a>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 py-12 sticky top-0 z-10">
          <div >
            <div className="text-xl font-medium text-slate-500 uppercase tracking-wider">
              <span className="text-slate-800 font-bold">{name}</span>
            </div>
            <div className='flex'>
              <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">
                Workspace: <span className="text-slate-800 font-bold">{role}</span>
              </div>
              {role === "ADMIN" && (
                <div className="text-[12px] mx-4 font-medium text-slate-500 uppercase tracking-wider">
                  Shop Id: <span className="text-slate-800 font-bold">{shopId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
              {role.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {/* DYNAMIC ROUTE PAGE CONTENT */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}