import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import Inventory from './pages/dashboard/Inventory.jsx';
import DashboardLayout from './components/common/DashboardLayout.jsx';
import SalePage from './pages/dashboard/SalePage.jsx';
import StockLowPage from './pages/dashboard/LowStockPage.jsx'

// Protected Route Guard Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  console.log("Token:", token);

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

        {/* ফলব্যাক রুট */}
        <Route path="*" element={<Navigate to="/" replace />} />


      </Routes>
    </Router>
  );
}

export default App;