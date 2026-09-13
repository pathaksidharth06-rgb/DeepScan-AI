import React, { useState } from 'react';
import { Home, Scan, History, BarChart3, Info, Waves, ShieldCheck, User } from 'lucide-react';

export type NavTab = 'home' | 'analyze' | 'history' | 'insights' | 'about';

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

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'analyze', label: 'Analyze', icon: Scan },
    { id: 'history', label: 'History', icon: History },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-8 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Subtitle */}
        <div
          onClick={() => onTabChange('analyze')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 via-stone-900 to-amber-950 flex items-center justify-center text-amber-400 shadow-sm transition-transform duration-200 group-hover:scale-105 border border-amber-900/40">
            <Waves className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
              DeepScan AI
            </h1>
            <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-1">
              Underwater Sonar Intelligence
            </span>
          </div>
        </div>

        {/* Central Nav Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 shadow-inner">
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
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-700' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System Status & Profile */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300/80 text-amber-900 text-xs font-semibold shadow-2xs select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="tracking-wide text-[11px] font-bold">AI SYSTEM ONLINE</span>
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
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95">
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
                    onRoleChange && onRoleChange('Operator');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    operatorRole === 'Operator'
                      ? 'bg-amber-50 text-amber-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Operator
                  </span>
                  {operatorRole === 'Operator' && <span className="text-[10px]">●</span>}
                </button>
                <button
                  onClick={() => {
                    onRoleChange && onRoleChange('Commander');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    operatorRole === 'Commander'
                      ? 'bg-amber-50 text-amber-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> Commander
                  </span>
                  {operatorRole === 'Commander' && <span className="text-[10px]">●</span>}
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
                      <span className="text-[11px] font-normal text-stone-400">Exit</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

