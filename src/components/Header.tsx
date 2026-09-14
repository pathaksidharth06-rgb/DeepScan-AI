import React, { useState } from 'react';
import {
  Home,
  Scan,
  History,
  BarChart3,
  Info,
  Waves,
  ShieldCheck,
  User,
  Menu,
  X,
} from 'lucide-react';

export type NavTab =
  | 'home'
  | 'analyze'
  | 'history'
  | 'insights'
  | 'about';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  operatorRole?: 'Operator' | 'Commander';
  onRoleChange?: (role: 'Operator' | 'Commander') => void;
  userEmail?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  operatorRole = 'Operator',
  onRoleChange,
  userEmail = 'admin@deepscan.ai',
  onLogout,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'analyze', label: 'Analyze', icon: Scan },
    { id: 'history', label: 'History', icon: History },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'about', label: 'About', icon: Info },
  ];

  const handleNavigation = (tab: NavTab) => {
    onTabChange(tab);
    setShowMobileMenu(false);
  };

  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-8 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto">
        {/* ========================= */}
        {/* MAIN HEADER ROW */}
        {/* ========================= */}
        <div className="flex items-center justify-between gap-3">
          {/* Logo */}
          <div
            onClick={() => handleNavigation('analyze')}
            className="flex items-center gap-3 cursor-pointer group select-none min-w-0"
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-slate-800 via-stone-900 to-amber-950 flex items-center justify-center text-amber-400 shadow-sm transition-transform duration-200 group-hover:scale-105 border border-amber-900/40">
              <Waves className="w-6 h-6 text-amber-400" />
            </div>

            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                DeepScan AI
              </h1>

              <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-1 truncate">
                Underwater Sonar Intelligence
              </span>
            </div>
          </div>

          {/* ========================= */}
          {/* DESKTOP NAVIGATION */}
          {/* ========================= */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  />

                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ========================= */}
          {/* SYSTEM STATUS & PROFILE */}
          {/* ========================= */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300/80 text-amber-900 text-xs font-semibold shadow-2xs select-none">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>

                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>

              <span className="tracking-wide text-[11px] font-bold">
                AI SYSTEM ONLINE
              </span>
            </div>

            {/* Mobile AI Status Dot */}
            <div
              className="sm:hidden relative flex h-2.5 w-2.5 mr-1"
              title="AI System Online"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>

              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </div>

            {/* User / Role Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="w-8 h-8 rounded-full bg-amber-700 hover:bg-amber-800 text-amber-50 font-semibold text-sm flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer ring-2 ring-amber-200"
                title={`Logged in as ${userEmail} (${operatorRole})`}
              >
                H
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95">
                  {/* User Info Header */}
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      Hydrographic Officer
                    </div>

                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {userEmail}
                    </div>
                  </div>

                  {/* Role Switcher */}
                  <div className="px-3 pt-2 pb-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Access Role
                  </div>

                  <button
                    onClick={() => {
                      onRoleChange &&
                        onRoleChange('Operator');

                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                      operatorRole === 'Operator'
                        ? 'bg-amber-50 text-amber-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      Operator
                    </span>

                    {operatorRole === 'Operator' && (
                      <span className="text-[10px]">
                        ●
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onRoleChange &&
                        onRoleChange('Commander');

                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                      operatorRole === 'Commander'
                        ? 'bg-amber-50 text-amber-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Commander
                    </span>

                    {operatorRole === 'Commander' && (
                      <span className="text-[10px]">
                        ●
                      </span>
                    )}
                  </button>

                  {/* Logout Button */}
                  {onLogout && (
                    <div className="mt-1 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>Sign Out</span>

                        <span className="text-[11px] font-normal text-stone-400">
                          Exit
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================= */}
            {/* MOBILE MENU BUTTON */}
            {/* ========================= */}
            <button
              onClick={() =>
                setShowMobileMenu(!showMobileMenu)
              }
              className="md:hidden w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors"
              aria-label={
                showMobileMenu
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={showMobileMenu}
            >
              {showMobileMenu ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* ========================= */}
        {/* MOBILE NAVIGATION */}
        {/* ========================= */}
        {showMobileMenu && (
          <nav className="md:hidden mt-3 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-1 gap-1.5 bg-slate-100/90 p-2 rounded-2xl border border-slate-200/70">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleNavigation(item.id)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    />

                    <span>{item.label}</span>

                    {isActive && (
                      <span className="ml-auto text-[10px] text-amber-700">
                        ●
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
