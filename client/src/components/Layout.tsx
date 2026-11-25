import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ClipboardCheck,
  Flame,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Truck,
  Users,
} from 'lucide-react';
import type { UserRole } from '@shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  inspector: 'Prüfer',
  viewer: 'Nur Lesen',
};

export function Layout() {
  const { user, departmentName, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pwOpen, setPwOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, show: true },
    { to: '/members', label: 'Kameraden', icon: Users, end: false, show: true },
    { to: '/inspections', label: 'Kontrolle', icon: ClipboardCheck, end: false, show: true },
    { to: '/vehicles', label: 'Fahrzeuge', icon: Truck, end: false, show: true },
    { to: '/settings', label: 'Einstellungen', icon: Settings, end: false, show: isAdmin },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-r md:border-slate-200 md:bg-white dark:md:border-slate-800 dark:md:bg-slate-900">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fire-600 text-white shadow-sm">
            <Flame className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {departmentName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Führerscheinverwaltung</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-fire-50 text-fire-700 dark:bg-fire-950/80 dark:text-fire-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {user && (
            <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user.display_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
              aria-label={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Passwort ändern"
              aria-label="Passwort ändern"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/60 dark:hover:text-red-400"
              title="Abmelden"
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fire-600 text-white">
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{departmentName}</p>
              {user && (
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user.display_name} · {ROLE_LABELS[user.role]}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Farbschema wechseln"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Passwort ändern"
            >
              <KeyRound className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/60"
              aria-label="Abmelden"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 md:px-8 md:py-7 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation */}
      <nav
        aria-label="Mobile Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden"
      >
        <div
          className={`grid ${
            navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
          } pb-[env(safe-area-inset-bottom)]`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'text-fire-600 dark:text-fire-400'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
