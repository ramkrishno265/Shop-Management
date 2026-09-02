import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenu, HiOutlineX, HiChevronDown } from "react-icons/hi";

export default function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth >= 768
  );

  // কোন মেনুটিতে সাব-মেনু আছে এবং সেটি ওপেন কি না তা ট্র্যাক করার জন্য স্টেট
  const [openSubmenu, setOpenSubmenu] = useState(null);

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

  // মেনু আইটেমগুলোতে সাব-মেনু বা children যোগ করা হলো
  const menuItems = [
    { name: "Dashboard", icon: "📊", path: "/dashboard" },
    { name: "Inventory", icon: "📦", path: "/inventory" },
    { name: "Sales & Billing", icon: "💼", path: "/salePage" },
    { name: "Purchase", icon: "🛒", path: "/purchase_page" },
    { name: "Profit & Margin", icon: "📈", path: "/profit" },
    { name: "Staff Management", icon: "👥", path: "#" },
    {
      name: "Returns & Refunds",
      icon: "⚙️",
      path: "#",
      // সাব-মেনু অপশনসমূহ
      children: [
        { name: "Sales Return", path: "/sales_return" },
        { name: "Purchase Return", path: "/purchase_return" },
        { name: "Printer Setup", path: "/settings/printer" },
      ]
    },
    {
      name: "Settings",
      icon: "⚙️",
      path: "#",
      // সাব-মেনু অপশনসমূহ
      children: [
        { name: "Shop Profile", path: "/shop_profile" },
        { name: "Product Field Settings", path: "/product_field_settings" },
        { name: "Printer Setup", path: "/settings/printer" },
      ]
    },
  ];

  const handleMenuClick = (item) => {
    // যদি সাব-মেনু থাকে তবে শুধু টগল করবে
    if (item.children) {
      setOpenSubmenu(openSubmenu === item.name ? null : item.name);
      return;
    }

    if (item.path && item.path !== "#") {
      navigate(item.path);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    }
  };

  const handleSubMenuClick = (path) => {
    navigate(path);
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
          w-64 flex flex-col
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:sticky
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 shrink-0">
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

        {/* Navigation - স্ক্রোলযোগ্য করা হয়েছে যাতে সাব-মেনু খুললে লিস্ট বড় হলে সমস্যা না হয় */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          {menuItems.map((item, idx) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openSubmenu === item.name;

            return (
              <div key={idx}>
                {/* মূল মেনু বাটন */}
                <button
                  onClick={() => handleMenuClick(item)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </div>

                  {/* যদি সাব-মেনু থাকে তবে একটি ড্রপডাউন অ্যারো বা আইকন দেখাবে */}
                  {hasChildren && (
                    <HiChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-slate-900" : "text-slate-400"
                        }`}
                    />
                  )}
                </button>

                {/* সাব-মেনু লিস্ট */}
                {hasChildren && isOpen && (
                  <div className="pl-9 pr-2 py-1 space-y-1 mt-1 border-l-2 border-slate-100 ml-4">
                    {item.children.map((subItem, subIdx) => (
                      <button
                        key={subIdx}
                        onClick={() => handleSubMenuClick(subItem.path)}
                        className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all"
                      >
                        {subItem.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              <HiOutlineMenu size={20} />
            </button>

            <div className="min-w-0">
              {/* User Name */}
              <h2 className="text-sm md:text-xl font-bold text-slate-800 truncate">
                {name}
              </h2>

              {/* Role & Shop */}
              <div className="flex flex-wrap items-center gap-1 md:gap-3 text-[10px] md:text-xs text-slate-500">
                <span>
                  Workspace: <span className="font-semibold text-slate-700">{role}</span>
                </span>

                {role === "ADMIN" && (
                  <span>
                    Shop: <span className="font-semibold text-slate-700">{shopId}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] md:text-xs font-bold text-slate-700">
              {role.charAt(0).toUpperCase()}
            </div>

            <button
              onClick={handleLogout}
              className="px-2 py-1 md:px-3 md:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] md:text-xs font-semibold transition-all"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}