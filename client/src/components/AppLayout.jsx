import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Flag,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  PhoneCall,
  Radio,
  ShieldAlert,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthProvider';
import { useSos } from './SosProvider';
import { get } from '../lib/api';
import { initials } from '../lib/format';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/navigate', label: 'Safe routes', icon: Navigation },
  { to: '/nearby', label: 'Nearby help', icon: MapPin },
  { to: '/share-location', label: 'Live sharing', icon: Radio },
  { to: '/reports', label: 'Report unsafe', icon: Flag },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/contacts', label: 'Trusted contacts', icon: Users },
  { to: '/awareness', label: 'Safety guides', icon: BookOpen },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { openSos } = useSos();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await get('/users/me/summary');
        if (active) setUnread(data.stats.unreadNotifications);
      } catch {
        /* silent */
      }
    };
    load();
    const id = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <Logo to="/dashboard" size={38} />
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <button type="button" className="sos-pulse btn w-full rounded-2xl bg-rose-600 px-4 py-3.5 text-white shadow-lg hover:bg-rose-700" onClick={openSos}>
        <ShieldAlert size={20} />
        <span className="text-base font-bold tracking-wide">SOS EMERGENCY</span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge && unread > 0 ? (
              <span className="rounded-full bg-blush-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3">
        <a
          href="tel:112"
          className="flex items-center gap-2.5 text-sm font-semibold text-brand-800 hover:text-brand-900"
        >
          <PhoneCall size={16} /> 112 · National emergency
        </a>
        <p className="mt-1.5 text-[11px] leading-snug text-brand-700/80">
          Women Helpline 181 · Police 100 · Ambulance 108
        </p>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50"
        >
          <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {initials(user?.fullName || 'You')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800">
              {user?.fullName}
            </span>
            <span className="block truncate text-[11px] text-slate-500">{user?.email}</span>
          </span>
          <UserRound size={16} className="text-slate-400" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fbf9ff]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-brand-100 bg-white lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-xs bg-white shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-100/80 bg-white/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="lg:hidden">
            <Logo to="/dashboard" size={30} subtitle={false} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-blush-500 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={openSos}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              <ShieldAlert size={15} /> SOS
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
