import React, { useState } from 'react';
import {
  Waves,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Quick Demo Auto-fill helper
  const handleAutofillDemo = () => {
    setEmail('admin@deepscan.ai');
    setPassword('DeepScan@123');
    setErrorMsg('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    // Verify against demo credentials
    setTimeout(() => {
      if (email.trim().toLowerCase() === 'admin@deepscan.ai' && password === 'DeepScan@123') {
        if (rememberMe) {
          localStorage.setItem('deepscan_auth', 'true');
          localStorage.setItem('deepscan_user_email', email.trim());
        } else {
          sessionStorage.setItem('deepscan_auth', 'true');
          sessionStorage.setItem('deepscan_user_email', email.trim());
        }
        setIsLoading(false);
        onLoginSuccess(email.trim());
      } else {
        setIsLoading(false);
        setErrorMsg('Invalid credentials. Use demo: admin@deepscan.ai / DeepScan@123');
      }
    }, 600);
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors duration-300 relative overflow-hidden ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Background Bathymetric Contour Overlay & Radar Radiating Rings */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Subtle acoustic radiating rings */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full border border-amber-500/20 animate-pulse pointer-events-none" />
        <div className="absolute -top-48 -left-48 w-[32rem] h-[32rem] rounded-full border border-stone-500/15 pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[36rem] h-[36rem] rounded-full border border-amber-600/20 pointer-events-none" />

        {/* Bathymetric contour lines */}
        <svg
          viewBox="0 0 1440 900"
          className="w-full h-full object-cover opacity-25"
          preserveAspectRatio="none"
        >
          <path
            d="M -100 200 C 300 150, 600 350, 1500 180"
            fill="none"
            stroke={isDarkMode ? '#d97706' : '#94a3b8'}
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          <path
            d="M -100 450 C 400 320, 800 580, 1500 390"
            fill="none"
            stroke={isDarkMode ? '#b45309' : '#cbd5e1'}
            strokeWidth="1.5"
          />
          <path
            d="M -100 700 C 350 820, 950 560, 1500 680"
            fill="none"
            stroke={isDarkMode ? '#f59e0b' : '#94a3b8'}
            strokeWidth="1.2"
          />
        </svg>

        {/* Ambient Gradient Glows (Amber + Stone) */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-stone-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Theme Toggle (Top Right) */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`p-2.5 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center gap-2 text-xs font-semibold ${
            isDarkMode
              ? 'bg-slate-900 border-slate-700 text-yellow-400 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm'
          }`}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="hidden sm:inline">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div
        className={`relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10 border shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 backdrop-blur-md ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800 shadow-amber-950/20'
            : 'bg-white/95 border-slate-200/90 shadow-slate-300/40'
        }`}
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-stone-900 via-amber-900 to-amber-700 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-900/25 mb-4 group transition-transform hover:scale-105 border border-amber-700/30">
            <Waves className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>DeepScan AI</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              v2.0
            </span>
          </h1>

          <p className="text-[11px] font-semibold tracking-wider uppercase text-amber-700 dark:text-amber-400 mt-1">
            Underwater Sonar Intelligence
          </p>

          <p
            className={`text-xs mt-2 max-w-xs leading-relaxed ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Autonomous Acoustic Threat Classification & Decision Support Platform
          </p>
        </div>

        {/* Demo Credentials Quick-Fill Pill */}
        <div
          onClick={handleAutofillDemo}
          className={`mb-5 p-3 rounded-2xl border text-xs cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between ${
            isDarkMode
              ? 'bg-slate-800/80 border-amber-900/60 text-slate-300 hover:border-amber-500/50'
              : 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100/80'
          }`}
          title="Click to auto-fill demo credentials"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="font-bold">Demo Login: </span>
              <span className="font-mono text-[11px] opacity-90">admin@deepscan.ai</span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md shadow-2xs shrink-0">
            Auto-fill
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-stone-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Email Address
            </label>
            <div className="relative">
              <Mail
                className={`w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@deepscan.ai"
                required
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className={`w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
              />
              <span
                className={`text-xs font-medium ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Remember me
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-semibold text-amber-700 hover:text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-5 rounded-2xl font-bold text-white text-sm shadow-lg shadow-amber-900/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #a76d4e 0%, #824f33 45%, #5a341f 100%)',
            }}
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Authenticating with DeepScan Engine...</span>
              </>
            ) : (
              <>
                <span>Sign In to Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Links & Security Assurance */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Don't have an operator account?{' '}
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="font-bold text-amber-700 hover:text-amber-600 dark:text-amber-400 cursor-pointer"
            >
              Create Account
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-500" />
            <span>Protected by Hydrographic Role-Based Access Control</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-sm w-full p-6 rounded-3xl border shadow-2xl space-y-4 animate-in fade-in ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-base font-bold">Password Recovery</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              For this prototype demo, please use the predefined master hydrographic credentials:
            </p>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-xs font-mono space-y-1">
              <div>Email: admin@deepscan.ai</div>
              <div>Password: DeepScan@123</div>
            </div>
            <button
              onClick={() => {
                handleAutofillDemo();
                setShowForgotModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-md shadow-amber-900/20"
            >
              Auto-fill Credentials & Close
            </button>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-sm w-full p-6 rounded-3xl border shadow-2xl space-y-4 animate-in fade-in ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 text-amber-700">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Operator Provisioning
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              DeepScan AI operates under standard Maritime Survey RBAC. You can instantly access all
              capabilities using the pre-provisioned demo commander account.
            </p>
            <button
              onClick={() => {
                handleAutofillDemo();
                setShowRegisterModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-md shadow-amber-900/20"
            >
              Use Commander Demo Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
