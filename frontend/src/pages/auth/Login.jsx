import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post(
        `${API_URL}/auth/login`,
        formData
      );

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-5">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">

        {/* Logo */}

        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">

            <Building2 className="text-white" size={30} />

          </div>
        </div>

        <div className="text-center">

          <h1 className="text-3xl font-bold text-slate-900">
            Welcome Back
          </h1>

          <p className="text-slate-500 mt-2">
            Sign in to your account
          </p>

        </div>

        {error && (
          <div className="mt-6 bg-red-100 border border-red-300 text-red-600 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 mt-8"
        >
          {/* Email */}

          <div>

            <label className="text-sm font-medium text-slate-700">
              Email Address
            </label>

            <div className="relative mt-2">

              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full h-12 rounded-xl border border-slate-300 pl-11 pr-4 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              />

            </div>

          </div>

          {/* Password */}

          <div>

            <label className="text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative mt-2">

              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full h-12 rounded-xl border border-slate-300 pl-11 pr-12 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>

            </div>

          </div>

          {/* Remember */}

          <div className="flex items-center justify-between text-sm">

            <label className="flex items-center gap-2 text-slate-600">

              <input type="checkbox" />

              Remember me

            </label>

            <button
              type="button"
              className="text-indigo-600 hover:underline"
            >
              Forgot Password?
            </button>

          </div>

          {/* Button */}

          <button
            disabled={loading}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex justify-center items-center gap-2 transition cursor-pointer"
          >
            {loading ? (
              "Signing In..."
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>

        </form>

        <div className="text-center mt-8 text-sm text-slate-600">

          Don't have an account?

          <button
            onClick={() =>
              navigate("/signup")
            }
            className="ml-2 text-indigo-600 font-semibold hover:underline cursor-pointer"
          >
            Create Account
          </button>

        </div>

      </div>

    </div>
  );
}