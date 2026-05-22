import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BarChart3,
  ShoppingBag,
  Package,
  Building2,
  ShieldCheck,
  UserCog,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';

const FEATURE_PILLS = [
  { icon: BarChart3, label: 'Real-time Analytics' },
  { icon: ShoppingBag, label: 'Smart Orders' },
  { icon: Package, label: 'Inventory Control' },
  { icon: Building2, label: 'Multi-Branch' },
];

const DEMO_ACCOUNTS = [
  {
    role: 'Admin',
    username: 'admin',
    password: 'admin',
    Icon: ShieldCheck,
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-600',
  },
  {
    role: 'Manager',
    username: 'manager',
    password: 'pass2',
    Icon: UserCog,
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-600',
  },
  {
    role: 'Waiter',
    username: 'waiter',
    password: 'pass',
    Icon: UtensilsCrossed,
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-600',
  },
  {
    role: 'Chef',
    username: 'chef',
    password: 'pass1',
    Icon: ChefHat,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-600',
  },
];

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitLogin = async (uname, pwd) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${getAPI_URL()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: pwd }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onLogin) onLogin(data.user, data.token);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitLogin(username, password);
  };

  const fillDemo = (acc) => {
    setUsername(acc.username);
    setPassword(acc.password);
  };

  return (
    <div className="min-h-screen w-full bg-[#fff7ef] flex">
      {/* ============================ LEFT PANEL ============================ */}
      <div className="hidden md:flex relative w-1/2 overflow-hidden">
        {/* dark restaurant background */}
        <div className="absolute inset-0">
          <img
            src="/restaurant-bg.jpg"
            alt=""
            className="w-full h-full object-cover opacity-30"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b0b10] via-[#15151c] to-[#1a1a24]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_45%)]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-10 lg:p-14 text-white">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/40">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Restaurant POS</p>
              <p className="text-xs text-gray-400 leading-tight">
                Premium Management System
              </p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="max-w-md">
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Run Your Restaurant.
              <br />
              <span className="text-orange-500">Smart. Simple.</span>
              <br />
              <span className="text-orange-500">Powerful.</span>
            </h1>
            <p className="mt-6 text-gray-300 text-base leading-relaxed max-w-sm">
              Manage orders, menus, kitchen, inventory, staff, and grow your
              business — all in one place.
            </p>

            {/* Feature pills */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {FEATURE_PILLS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 bg-white/95 text-gray-800 rounded-full px-4 py-2.5 shadow-md"
                >
                  <Icon className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div />
        </div>
      </div>

      {/* ============================ RIGHT PANEL ============================ */}
      <div className="flex-1 flex flex-col items-center justify-start md:justify-center px-4 sm:px-8 py-10 md:py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Welcome Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-orange-100/60 p-8 sm:p-10">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200">
                <Flame className="w-7 h-7 text-white" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 text-center">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 text-center mt-1">
              Sign in to your POS dashboard
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Username */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-12 text-gray-400">
                  <User className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                  disabled={loading}
                  autoComplete="username"
                  className="login-input w-full pl-12 pr-4 py-3.5 rounded-full bg-orange-50/40 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-12 text-gray-400">
                  <Lock className="w-[18px] h-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="login-input w-full pl-12 pr-12 py-3.5 rounded-full bg-orange-50/40 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-orange-500 font-semibold hover:text-orange-600"
                  onClick={() =>
                    setError(
                      'Please contact your administrator to reset your password.'
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-base shadow-md shadow-orange-200 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Login to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* OR divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400 tracking-wider">
                OR
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Demo Account button */}
            <button
              type="button"
              onClick={() => fillDemo(DEMO_ACCOUNTS[0])}
              className="w-full py-3.5 rounded-full bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-2"
            >
              <span className="w-4 h-4 rounded-full border-2 border-gray-400" />
              Login with Demo Account
            </button>
          </div>

          {/* Demo Credentials Card */}
          <div className="mt-5 bg-white rounded-3xl shadow-xl border border-orange-100/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <User className="w-4 h-4 text-orange-500" />
              </div>
              <p className="font-bold text-gray-900">Demo Credentials</p>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              Click on any role to auto-fill credentials
            </p>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const { Icon } = acc;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 hover:border-orange-300 hover:shadow-md transition p-3 bg-white"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${acc.badgeBg}`}
                    >
                      <Icon className={`w-5 h-5 ${acc.badgeText}`} />
                    </div>
                    <div className="text-center leading-tight">
                      <p className="text-sm font-semibold text-gray-800">
                        {acc.role}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {acc.username}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-gray-500 hover:text-orange-500 transition"
            >
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
