import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HiOutlineMenuAlt2,
  HiOutlineX,
  HiChevronDown,
  HiOutlineLogout,
} from "react-icons/hi";
import {
  FiGrid,
  FiBox,
  FiShoppingBag,
  FiTruck,
  FiTrendingUp,
  FiUsers,
  FiRotateCcw,
  FiSettings,
  FiPrinter,
  FiSliders,
  FiCornerDownRight,
  FiBookOpen,
  FiArrowDownLeft,
  FiArrowUpRight,
} from "react-icons/fi";
import { RiStore2Line } from "react-icons/ri";

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "STAFF";
  const name = user.name || "Unknown User";
  const shopId = user.shopId || "N/A";

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // সক্রিয় রাউট অনুযায়ী সাব-মেনু অটো ওপেন রাখা
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.children?.some((child) => child.path === location.pathname)) {
        setOpenSubmenu(item.name);
      }
    });
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const menuItems = [
    { name: "Dashboard", icon: FiGrid, path: "/dashboard" },
    { name: "Inventory", icon: FiBox, path: "/inventory" },
    { name: "Sales & Billing", icon: FiShoppingBag, path: "/salePage" },
    { name: "Purchase", icon: FiTruck, path: "/purchase_page" },
    
    { name: "Profit & Margin", icon: FiTrendingUp, path: "/profit" },
    { name: "Staff Management", icon: FiUsers, path: "#" },
    {
      name: "Due Management",
      icon: FiBookOpen,
      path: "#",
      children: [
        {
          name: "Customer Due (Receivable)",
          path: "/due_payment",
          icon: FiArrowDownLeft,
        },
        {
          name: "Supplier Due (Payable)",
          path: "/due_supplier",
          icon: FiArrowUpRight,
        },
      ],
    },
    {
      name: "Returns & Refunds",
      icon: FiRotateCcw,
      path: "#",
      children: [
        { name: "Sales Return", path: "/sales_return" },
        { name: "Purchase Return", path: "/purchase_return" },
      ],
    },
    {
      name: "Settings",
      icon: FiSettings,
      path: "#",
      children: [
        { name: "Shop Profile", path: "/shop_profile", icon: RiStore2Line },
        { name: "Product Field Settings", path: "/product_field_settings", icon: FiSliders },
        { name: "Printer Setup", path: "/settings/printer", icon: FiPrinter },
      ],
    },
  ];

  const handleMenuClick = (item) => {
    if (item.children) {
      setOpenSubmenu(openSubmenu === item.name ? null : item.name);
      return;
    }

    if (item.path && item.path !== "#") {
      navigate(item.path);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleSubMenuClick = (path) => {
    navigate(path);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200/80
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] w-68 flex flex-col justify-between
          ${isSidebarOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full"}
          md:translate-x-0 md:sticky
        `}
      >
        {/* Top Part: Logo + Nav */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Header */}
          <div className="h-18 px-5 flex items-center justify-between border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group cursor-pointer transition-transform duration-300 hover:scale-105">
                <RiStore2Line size={22} className="transition-transform group-hover:rotate-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-slate-900 text-base leading-tight block">
                  Shop<span className="text-blue-600">Sync</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                  POS & Inventory fdgdfg
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all active:scale-95"
            >
              <HiOutlineX size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5 overflow-y-auto flex-1 select-none">
            <div className="px-3.5 pt-2 pb-1.5 text-[10px] font-black text-slate-400/90 uppercase tracking-wider">
              Management
            </div>

            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = openSubmenu === item.name;
              const isDirectActive = location.pathname === item.path;
              const isChildActive = item.children?.some((child) => child.path === location.pathname);
              const isActive = isDirectActive || isChildActive;

              return (
                <div key={idx} className="space-y-1">
                  {/* মেনু বাটন with Left Indicator on Active */}
                  <button
                    onClick={() => handleMenuClick(item)}
                    className={`
                      relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold
                      transition-all duration-200 cursor-pointer text-left group overflow-hidden
                      ${
                        isActive && !hasChildren
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                          : isActive && hasChildren
                          ? "bg-blue-50/80 text-blue-700 font-bold"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 hover:translate-x-1"
                      }
                    `}
                  >
                    {/* একটিভ থাকলে ইন্ডিকেটর বার */}
                    {isActive && !hasChildren && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-xs"></span>
                    )}

                    <div className="flex items-center gap-3 relative z-10">
                      <span
                        className={`
                          p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center
                          ${
                            isActive && !hasChildren
                              ? "bg-white/20 text-white"
                              : isActive
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100/70 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:scale-110"
                          }
                        `}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="tracking-wide">{item.name}</span>
                    </div>

                    {hasChildren && (
                      <HiChevronDown
                        size={15}
                        className={`transition-transform duration-300 ease-out ${
                          isOpen ? "rotate-180 text-blue-600" : "text-slate-400 group-hover:text-slate-700"
                        }`}
                      />
                    )}
                  </button>

                  {/* ড্রপডাউন সাব-মেনু */}
                  <div
                    className={`
                      grid transition-all duration-300 ease-in-out
                      ${isOpen && hasChildren ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}
                    `}
                  >
                    <div className="overflow-hidden pl-7 pr-1 space-y-1 mt-0.5 border-l-2 border-slate-100 ml-5">
                      {item.children?.map((subItem, subIdx) => {
                        const isSubActive = location.pathname === subItem.path;
                        const SubIcon = subItem.icon || FiCornerDownRight;
                        return (
                          <button
                            key={subIdx}
                            onClick={() => handleSubMenuClick(subItem.path)}
                            className={`
                              w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-2
                              hover:translate-x-1 cursor-pointer
                              ${
                                isSubActive
                                  ? "bg-blue-600 text-white font-bold shadow-xs shadow-blue-500/20"
                                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              }
                            `}
                          >
                            <SubIcon
                              size={13}
                              className={`transition-colors shrink-0 ${isSubActive ? "text-white" : "text-slate-400"}`}
                            />
                            <span className="truncate">{subItem.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Part: User Status & Logout */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          <div className="p-2.5 bg-white rounded-2xl border border-slate-200/70 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                {name.charAt(0)}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{name}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                  {role} {shopId !== "N/A" ? `• #${shopId}` : ""}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer active:scale-95"
              title="Logout"
            >
              <HiOutlineLogout size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-18 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
            >
              <HiOutlineMenuAlt2 size={20} />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-slate-800 truncate flex items-center gap-1.5">
                <span className="text-slate-400 font-normal">Welcome,</span>
                <span className="text-slate-900 font-extrabold">{name}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/70">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Shop Active:</span>
              <span className="font-bold text-slate-900">#{shopId}</span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
            >
              <HiOutlineLogout size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}