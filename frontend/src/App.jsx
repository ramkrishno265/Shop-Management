import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import DashboardHome from "./pages/dashboard/DashboardHome.jsx";
import Inventory from "./pages/dashboard/Inventory.jsx";
import DashboardLayout from "./components/common/DashboardLayout.jsx";
import SalePage from "./pages/dashboard/SalePage.jsx";
import StockLowPage from "./pages/dashboard/LowStockPage.jsx";
import PurchasePage from "./pages/dashboard/purches.jsx";
import ProfitMargin from "./pages/dashboard/profitMargin.jsx";
import ProductEntry from "./pages/dashboard/ProductEntry.jsx";
import ProductEdit from "./pages/dashboard/ProductEdit.jsx";
import AddCustomer from "./pages/dashboard/AddCustomer.jsx";
import BulkImportPage from "./pages/dashboard/BulkImportPage.jsx";
import ShopProfile from "./pages/Setting_Option/ShopProfile.jsx"; // Import the BulkImportPage component
import ProductFieldSettings from "./pages/Setting_Option/ProductFieldSettings.jsx"; // Import the BulkImportPage component


// Protected Route Guard Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* পাবলিক রুটস */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* প্রোটেক্টেড ড্যাশবোর্ড রুট */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardHome />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* প্রোটেক্টেড ইনভেন্টরি রুট */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Inventory />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* ফলব্যাক রুট */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route
          path="/salePage"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SalePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock_low"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <StockLowPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase_page"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <PurchasePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profit"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProfitMargin />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/product_entry"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductEntry />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/product_edit/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ProductEdit />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/add_customer"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AddCustomer />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/bulk_import"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <BulkImportPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

            <Route
              path="/shop_profile"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ShopProfile />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/product_field_settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductFieldSettings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

        {/* ফলব্যাক রুট */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
