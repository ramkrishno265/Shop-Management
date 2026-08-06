import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth >= 768
  );

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user.role || "STAFF";
  const name = user.name || "Unknown";
  const shopId = user.shopId || "N/A";

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const menuItems = [
    { name: "Dashboard", icon: "📊", path: "/dashboard" },
    { name: "Inventory", icon: "📦", path: "/inventory" },
    { name: "Sales & Billing", icon: "💼", path: "/salePage" },
    { name: "Purchase", icon: "🛒", path: "/purchase_page" },
    { name: "Profit & Margin", icon: "📈", path: "/profit" },
    { name: "Staff Management", icon: "👥", path: "#" },
  ];

  const handleMenuClick = (path) => {
    if (path !== "#") {
      navigate(path);
    }

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-30 h-screen bg-white border-r border-slate-200
          transition-transform duration-300 ease-in-out
          w-64
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:sticky
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <span className="font-bold tracking-tight text-sm">
              ShopManager
            </span>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 rounded hover:bg-slate-100"
          >
            <HiOutlineX size={22} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleMenuClick(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer text-left"
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              <HiOutlineMenu size={22} />
            </button>

            <div>
              <div className="text-base md:text-xl font-medium text-slate-500 uppercase tracking-wider">
                <span className="text-slate-800 font-bold">{name}</span>
              </div>

              <div className="flex flex-wrap gap-2 md:gap-4">
                <div className="text-[11px] md:text-[12px] font-medium text-slate-500 uppercase tracking-wider">
                  Workspace:{" "}
                  <span className="text-slate-800 font-bold">{role}</span>
                </div>

                {role === "ADMIN" && (
                  <div className="text-[11px] md:text-[12px] font-medium text-slate-500 uppercase tracking-wider">
                    Shop Id:{" "}
                    <span className="text-slate-800 font-bold">{shopId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 md:gap-4">
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

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}