import { useState } from 'react';
import { Header } from './components/Header';
import type { NavTab } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { AnalyzePage } from './pages/AnalyzePage';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { InsightsPage } from './pages/InsightsPage';
import { AboutPage } from './pages/AboutPage';

export function App() {
  // Authentication state managed in localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('deepscan_auth') === 'true' || sessionStorage.getItem('deepscan_auth') === 'true';
  });

  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('deepscan_user_email') || sessionStorage.getItem('deepscan_user_email') || 'admin@deepscan.ai';
  });

  const [activeTab, setActiveTab] = useState<NavTab>('analyze');
  const [operatorRole, setOperatorRole] = useState<'Operator' | 'Commander'>('Operator');

  const handleLoginSuccess = (email: string) => {
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('deepscan_auth');
    localStorage.removeItem('deepscan_user_email');
    sessionStorage.removeItem('deepscan_auth');
    sessionStorage.removeItem('deepscan_user_email');
    setIsAuthenticated(false);
  };

  // If not authenticated, show the Login Page first
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Once authenticated, show the existing DeepScan AI dashboard exactly as it is
  return (
    <div className="min-h-screen bathymetric-bg flex flex-col relative text-slate-800 selection:bg-amber-500 selection:text-white">
      {/* Subtle Bathymetric Depth Contour Vector Overlay in Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden z-0">
        <svg
          viewBox="0 0 1440 900"
          className="w-full h-full object-cover"
          preserveAspectRatio="none"
        >
          <path
            d="M -100 200 C 300 150, 600 350, 1500 180"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="8 6"
          />
          <path
            d="M -100 450 C 400 320, 800 580, 1500 390"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <path
            d="M -100 700 C 350 820, 950 560, 1500 680"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <path
            d="M 200 -50 C 500 300, 450 700, 300 950"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <path
            d="M 1100 -50 C 950 350, 1050 650, 1200 950"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Main App Bar with Logout */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        operatorRole={operatorRole}
        onRoleChange={setOperatorRole}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      {/* Page Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {activeTab === 'analyze' && <AnalyzePage />}
        {activeTab === 'home' && <HomePage onNavigate={setActiveTab} />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'insights' && <InsightsPage />}
        {activeTab === 'about' && <AboutPage />}
      </main>
    </div>
  );
}

export default App;
