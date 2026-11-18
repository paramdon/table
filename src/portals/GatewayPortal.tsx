import React from 'react';
import { useRouter } from '../router/Router';
import {
  Smartphone,
  ChefHat,
  Bell,
  Building2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import { restaurantDb } from '../services/db';

export const GatewayPortal: React.FC = () => {
  const { navigate } = useRouter();
  const restaurant = restaurantDb.getRestaurant();
  const tables = restaurantDb.getTables();
  const orders = restaurantDb.getOrders();

  const portals = [
    {
      id: 'customer',
      route: '/customer?table=01',
      title: 'Customer Portal',
      subtitle: 'Tabletop QR Ordering & Live Tracking',
      description:
        'Full-screen mobile web menu for diners. Direct kitchen order firing, dish customizations, live order progress, and instant UPI bill settlement.',
      icon: Smartphone,
      accentColor: '#F76707',
      badge: 'Table 01 Session',
      target: 'Diners & Guests',
      cta: 'Open Customer Menu (/customer)',
    },
    {
      id: 'kitchen',
      route: '/kitchen',
      title: 'Kitchen Portal',
      subtitle: 'Bawarchikhana KDS Display',
      icon: ChefHat,
      accentColor: '#DC2626',
      badge: `${orders.filter((o) => ['received', 'accepted', 'preparing'].includes(o.status)).length} Active Orders`,
      target: 'Kitchen Staff & Cooks',
      description:
        'Dedicated kitchen display interface. Order cards, preparation timers, and one-tap status updates (Accept, Preparing, Ready, Served).',
      cta: 'Open Kitchen Display (/kitchen)',
    },
    {
      id: 'waiter',
      route: '/waiter',
      title: 'Waiter Portal',
      subtitle: 'Floor Captain & Service Console',
      icon: Bell,
      accentColor: '#2563EB',
      badge: 'Live Buzzers',
      target: 'Floor Waiters & Captains',
      description:
        'Dedicated staff interface. Real-time waiter requests (water, cutlery, chutneys, finger bowl, bill) and food ready-for-pickup notifications.',
      cta: 'Open Waiter Console (/waiter)',
    },
    {
      id: 'owner',
      route: '/owner',
      title: 'Owner Portal',
      subtitle: 'Enterprise Restaurant Management',
      icon: Building2,
      accentColor: '#18181B',
      badge: `${tables.length} Tables Active`,
      target: 'Proprietor & General Manager',
      description:
        'Independent restaurant management dashboard with sidebar navigation: sales analytics, 2D floor map, menu management, QR stands, and staff controls.',
      cta: 'Open Owner Dashboard (/owner)',
    },
  ];

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col font-sans overflow-x-hidden">
      {/* Top Banner */}
      <header className="border-b border-white/10 px-4 py-4 bg-[#121214]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F76707] flex items-center justify-center font-extrabold text-sm text-white shadow-md">
              UDM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold font-heading text-white tracking-tight">
                  Ur.Dear.Menu
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#FFDBCC]">
                  Hospitality Platform
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">{restaurant.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/staff-login')}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ShieldCheck size={13} className="text-[#F76707]" />
              <span>Staff Device Login (/staff-login)</span>
            </button>
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hidden sm:flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Role-Isolated Portals</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Gateway Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-8 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold font-heading mb-1">
            <Sparkles size={14} className="text-[#F76707]" />
            <span>Dedicated Multi-Portal Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-heading text-white tracking-tight">
            Select Your Designated Role Portal
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
            Each portal operates under its own isolated URL route, independent layout, and role-based authentication, backed by a single real-time restaurant database.
          </p>
        </div>

        {/* 4 Dedicated Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {portals.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                onClick={() => navigate(p.route)}
                className="bg-[#27272A] hover:bg-[#323238] border border-white/10 hover:border-[#F76707]/50 rounded-3xl p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-xl hover:shadow-2xl"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105"
                      style={{ backgroundColor: p.accentColor }}
                    >
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white font-mono">
                      {p.badge}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                      {p.target}
                    </div>
                    <h2 className="text-lg font-extrabold font-heading text-white mt-0.5">
                      {p.title}
                    </h2>
                    <p className="text-xs text-[#D4D4D8] mt-2 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFDBCC] group-hover:text-white">
                  <span>{p.cta}</span>
                  <ArrowRight
                    size={16}
                    className="text-[#F76707] group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Architecture Note Footer */}
        <div className="mt-10 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#A1A1AA] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
            <span>
              Real-time synchronization active: Orders fired in <code className="text-white">/customer</code> appear instantly in <code className="text-white">/kitchen</code> and update <code className="text-white">/owner</code>.
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#71717A]">
            Ur.Dear.Menu • Live Sync Active
          </span>
        </div>
      </main>
    </div>
  );
};
