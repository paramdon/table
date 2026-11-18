import React from 'react';
import { Bell, Search, Users, Smartphone, Monitor, Sparkles, ChefHat } from 'lucide-react';
import { TableSession, WaiterCall } from '../types/dining';

interface HeaderProps {
  session: TableSession;
  waiterCall: WaiterCall;
  onOpenCallWaiter: () => void;
  onOpenSearch: () => void;
  onOpenDiners: () => void;
  onOpenTableSwitch: () => void;
  previewMode: 'mobile' | 'tablet';
  onTogglePreviewMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  waiterCall,
  onOpenCallWaiter,
  onOpenSearch,
  onOpenDiners,
  onOpenTableSwitch,
  previewMode,
  onTogglePreviewMode,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F4F4F5] transition-all">
      {/* Top Utility Bar */}
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Table Status Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTableSwitch}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F4F2FD] hover:bg-[#EEEDF7] border border-[#E3E1EC] transition-all text-left"
            title="Change Table or Scan QR Stand"
          >
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-heading text-[#18181B] tracking-tight">
                  {session.tableName}
                </span>
                <span className="text-[10px] text-[#A14000] font-semibold bg-[#FFDBCC] px-1.5 py-0.2 rounded-full">
                  {session.zone}
                </span>
              </div>
              <span className="text-[10px] text-[#52525B] hidden sm:inline">
                Captain: {session.captainName}
              </span>
            </div>
          </button>

          {/* Active Diners at Table */}
          <button
            onClick={onOpenDiners}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#FAFAFA] hover:bg-[#F4F4F5] border border-[#E4E4E7] text-xs text-[#52525B] transition-all"
            title="View Diners sitting at this table"
          >
            <div className="flex -space-x-1.5 overflow-hidden">
              {session.activeDiners.map((diner) => (
                <div
                  key={diner.id}
                  style={{ backgroundColor: diner.avatarColor }}
                  className="inline-block h-5 w-5 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center"
                >
                  {diner.initials}
                </div>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-[#18181B] hidden xs:inline">
              {session.activeDiners.length}
            </span>
          </button>
        </div>

        {/* Center: Restaurant Identity */}
        <div className="hidden md:flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold font-heading tracking-wider text-[#18181B] uppercase">
              The Saffron Verandah
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F76707]" />
          </div>
          <span className="text-[10px] text-[#71717A] tracking-wider uppercase font-medium">
            द सैफ्रन बरामदा • Tabletop Dining
          </span>
        </div>

        {/* Right Actions: Call Captain + Search + Device Switcher */}
        <div className="flex items-center gap-2">
          {/* Call Waiter / Captain */}
          <button
            onClick={onOpenCallWaiter}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-heading transition-all shadow-2xs ${
              waiterCall.active
                ? 'bg-[#FFDBCC] text-[#7B2F00] border border-[#F76707]/40 animate-pulse'
                : 'bg-[#F4F4F5] hover:bg-[#EEEDF7] text-[#18181B] border border-[#E4E4E7]'
            }`}
            aria-label="Call Captain"
          >
            <Bell
              size={13}
              className={waiterCall.active ? 'text-[#F76707] animate-bounce' : 'text-[#71717A]'}
            />
            <span>{waiterCall.active ? 'Captain Coming' : 'Call Captain'}</span>
          </button>

          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] flex items-center justify-center text-[#18181B] transition-all"
            aria-label="Search dishes"
            title="Search dishes"
          >
            <Search size={15} />
          </button>

          {/* Responsive Preview Device Switcher */}
          <button
            onClick={onTogglePreviewMode}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#FAFAFA] hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[11px] font-medium text-[#52525B] transition-all"
            title={`Switch to ${previewMode === 'mobile' ? 'Tablet / KDS View' : 'Mobile View'}`}
          >
            {previewMode === 'mobile' ? (
              <>
                <Monitor size={13} className="text-[#F76707]" />
                <span className="hidden lg:inline">Tablet Board</span>
              </>
            ) : (
              <>
                <Smartphone size={13} className="text-[#F76707]" />
                <span className="hidden lg:inline">Mobile View</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
