import React, { useState, useEffect } from 'react';
import { X, Users, Check, RefreshCw, UserPlus, MapPin, Sparkles, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { TableSession, Diner } from '../types/dining';

interface TableDinersModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TableSession;
  onUpdateSession: (updatedSession: TableSession) => void;
  onResetSession: () => void;
}

export const TableDinersModal: React.FC<TableDinersModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
  onResetSession,
}) => {
  const [newDinerName, setNewDinerName] = useState('');
  const [activeTab, setActiveTab] = useState<'diners' | 'table' | 'qr'>('diners');
  const [tableQrUrl, setTableQrUrl] = useState<string>('');

  const availableTables = [
    { number: '4', name: 'Table 4', zone: 'Verandah Courtyard', captain: 'Rajesh Sharma' },
    { number: '12', name: 'Table 12', zone: 'Haveli Royal Hall', captain: 'Vikram Singh' },
    { number: '9', name: 'Table 9', zone: 'Private Dining Alcove', captain: 'Rajesh Sharma' },
    { number: '18', name: 'Table 18', zone: 'Terrace Starlight Deck', captain: 'Amitabh Sen' },
  ];

  // Generate table QR Code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const joinUrl = `${window.location.origin}${window.location.pathname}?table=${session.tableNumber}`;
      QRCode.toDataURL(joinUrl, {
        width: 220,
        margin: 1.5,
        color: {
          dark: '#18181B',
          light: '#FFFFFF',
        },
      })
        .then((url) => setTableQrUrl(url))
        .catch((e) => console.error(e));
    }
  }, [session.tableNumber]);

  if (!isOpen) return null;

  const handleAddDiner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDinerName.trim()) return;

    const colors = ['#F76707', '#2563EB', '#16A34A', '#7C3AED', '#DB2777', '#EA580C'];
    const randomColor = colors[session.activeDiners.length % colors.length];
    const words = newDinerName.trim().split(' ');
    const initials =
      words.length > 1
        ? `${words[0][0]}${words[1][0]}`.toUpperCase()
        : words[0].slice(0, 2).toUpperCase();

    const newDiner: Diner = {
      id: `diner-${Date.now()}`,
      name: newDinerName.trim(),
      avatarColor: randomColor,
      initials,
    };

    onUpdateSession({
      ...session,
      activeDiners: [...session.activeDiners, newDiner],
    });
    setNewDinerName('');
  };

  const handleSelectTable = (tbl: typeof availableTables[0]) => {
    onUpdateSession({
      ...session,
      tableNumber: tbl.number,
      tableName: tbl.name,
      zone: tbl.zone,
      captainName: tbl.captain,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F4F4F5] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold font-heading text-[#18181B]">
              Table & Diners Settings
            </h2>
            <p className="text-xs text-[#71717A]">
              Live tabletop coordination ({session.tableName})
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Segmented Tab */}
        <div className="px-5 pt-3">
          <div className="flex bg-[#F4F4F5] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('diners')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                activeTab === 'diners'
                  ? 'bg-white text-[#18181B] shadow-2xs'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Diners ({session.activeDiners.length})
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                activeTab === 'qr'
                  ? 'bg-white text-[#18181B] shadow-2xs'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Table QR Stand
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                activeTab === 'table'
                  ? 'bg-white text-[#18181B] shadow-2xs'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Switch Table
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-[#18181B]">
          {activeTab === 'qr' && (
            <div className="text-center py-4 space-y-3">
              <div className="bg-[#FAFAFA] p-4 rounded-2xl border border-[#E4E4E7] inline-block shadow-sm">
                <span className="text-xs font-bold font-heading text-[#18181B] block mb-2 uppercase tracking-wider">
                  Scan to Join {session.tableName}
                </span>
                {tableQrUrl && (
                  <div className="bg-white p-2 rounded-xl border border-[#E4E4E7] inline-block shadow-xs">
                    <img src={tableQrUrl} alt="Table QR" className="w-48 h-48 mx-auto" />
                  </div>
                )}
                <p className="text-[11px] text-[#71717A] mt-2">
                  Anyone at your table can scan this QR code with their phone to view the menu, add dishes, and track live order progress in real time.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'diners' && (
            <div className="space-y-4">
              <p className="text-xs text-[#52525B]">
                People sitting at <span className="font-bold text-[#18181B]">{session.tableName}</span> can order together in real time and split the bill seamlessly.
              </p>

              {/* Diners list */}
              <div className="space-y-2">
                {session.activeDiners.map((diner) => (
                  <div
                    key={diner.id}
                    className="p-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: diner.avatarColor }}
                        className="w-8 h-8 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-xs"
                      >
                        {diner.initials}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#18181B]">
                          {diner.name}
                        </div>
                        <div className="text-[10px] text-[#71717A]">
                          {diner.isCurrentUser ? 'Your Device (Active Session)' : 'Dining Companion'}
                        </div>
                      </div>
                    </div>
                    {diner.isCurrentUser && (
                      <span className="text-[10px] font-bold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#16A34A]/20">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Diner form */}
              <form onSubmit={handleAddDiner} className="space-y-2 pt-2 border-t border-[#F4F4F5]">
                <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A] block">
                  Add Dining Companion
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDinerName}
                    onChange={(e) => setNewDinerName(e.target.value)}
                    placeholder="Enter companion's name..."
                    maxLength={24}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] focus:border-[#F76707] focus:bg-white focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold font-heading flex items-center gap-1 transition-all"
                  >
                    <UserPlus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'table' && (
            <div className="space-y-3">
              <p className="text-xs text-[#52525B]">
                Select your table in the restaurant:
              </p>

              <div className="space-y-2">
                {availableTables.map((tbl) => {
                  const isCurrent = session.tableNumber === tbl.number;
                  return (
                    <div
                      key={tbl.number}
                      onClick={() => handleSelectTable(tbl)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'border-[#F76707] bg-[#FFDBCC]/20 shadow-xs'
                          : 'border-[#E4E4E7] bg-white hover:border-[#D4D4D8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center text-[#18181B] font-bold font-heading text-xs">
                          {tbl.number}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#18181B]">{tbl.name}</div>
                          <div className="text-[11px] text-[#71717A]">{tbl.zone} • Captain: {tbl.captain}</div>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-[10px] font-bold text-[#A14000] bg-[#FFDBCC] px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      ) : (
                        <span className="text-xs text-[#71717A] hover:text-[#18181B]">
                          Select →
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#F4F4F5]">
                <button
                  type="button"
                  onClick={() => {
                    onResetSession();
                    onClose();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <RefreshCw size={13} />
                  <span>Clear Table Slip & Start Fresh</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
