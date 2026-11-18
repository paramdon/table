import React, { useState } from 'react';
import {
  Users,
  QrCode,
  Plus,
  LayoutGrid,
  Layers,
  Sparkles,
  Lock,
  Trash2,
} from 'lucide-react';
import { RestaurantTable, TableStatus, Order, WaiterRequest } from '../../types/dcc';
import { formatINR } from '../../utils/formatters';
import {
  useEntitlements,
  buildAuthHeaders,
  parseFeatureLockedPayload,
} from '../../hooks/useEntitlements';
import { UpgradePromptModal } from './UpgradePromptModal';

interface FloorManagementViewProps {
  restaurantId?: string;
  ownerToken?: string;
  tables: RestaurantTable[];
  orders: Order[];
  waiterRequests: WaiterRequest[];
  onSelectTable: (table: RestaurantTable) => void;
  onUpdateTableStatus: (tableId: string, status: TableStatus) => void;
  onAddTable: (table: Partial<RestaurantTable>) => void;
  onOpenTableQr: (table: RestaurantTable) => void;
  onOpenBillingPlans?: (recommendedPlanId?: string) => void;
}

export const FloorManagementView: React.FC<FloorManagementViewProps> = ({
  restaurantId = 'demo-restaurant',
  ownerToken,
  tables,
  orders,
  waiterRequests,
  onSelectTable,
  onUpdateTableStatus,
  onAddTable,
  onOpenTableQr,
  onOpenBillingPlans,
}) => {
  const {
    hasFeature,
    lockedPrompt,
    setLockedPrompt,
    triggerLockedFeature,
  } = useEntitlements(restaurantId, ownerToken);

  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [floorSubView, setFloorSubView] = useState<'tables' | 'visual_map' | 'multi_floor' | 'banquets'>('tables');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');
  const [newZone, setNewZone] = useState('Courtyard Verandah');

  // Plan-gated backend state for Multi-Floor Zones & Banquets
  const [serverZones, setServerZones] = useState<any[]>([]);
  const [zoneNameInput, setZoneNameInput] = useState('');
  const [zoneFloorLevelInput, setZoneFloorLevelInput] = useState('First Floor');
  const [banquets, setBanquets] = useState<any[]>([]);
  const [banquetTitle, setBanquetTitle] = useState('');
  const [banquetHost, setBanquetHost] = useState('');
  const [banquetGuests, setBanquetGuests] = useState('80');

  const zones = Array.from(new Set(tables.map((t) => t.zone)));

  const filteredTables = tables.filter((t) => {
    if (selectedZone !== 'all' && t.zone !== selectedZone) return false;
    return true;
  });

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { label: 'Available', bg: 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/25' };
      case 'occupied':
        return { label: 'Occupied', bg: 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]/25' };
      case 'new_order':
        return { label: 'New Order', bg: 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30 animate-pulse' };
      case 'waiting_waiter':
        return { label: 'Needs Waiter', bg: 'bg-[#FFDBCC] text-[#A14000] border-[#F76707]/30 animate-bounce' };
      case 'bill_requested':
        return { label: 'Bill Requested', bg: 'bg-[#FFFBEB] text-[#D97706] border-[#F59E0B]/30' };
      case 'needs_cleaning':
        return { label: 'Needs Cleaning', bg: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]' };
      default:
        return { label: status, bg: 'bg-[#FAFAFA] text-[#71717A] border-[#E4E4E7]' };
    }
  };

  const handleOpenGatedTab = async (tab: 'visual_map' | 'multi_floor' | 'banquets') => {
    const endpoint =
      tab === 'visual_map'
        ? `/api/workspace/${restaurantId}/floor-map`
        : tab === 'multi_floor'
        ? `/api/workspace/${restaurantId}/floor-zones`
        : `/api/workspace/${restaurantId}/banquets`;

    try {
      const res = await fetch(endpoint, { headers: buildAuthHeaders(ownerToken) });
      const data = await res.json();
      if (!res.ok) {
        const locked = parseFeatureLockedPayload(data);
        if (locked) {
          triggerLockedFeature(locked);
          return;
        }
      }
      if (tab === 'multi_floor' && Array.isArray(data.zones)) setServerZones(data.zones);
      if (tab === 'banquets' && Array.isArray(data.banquets)) setBanquets(data.banquets);
      setFloorSubView(tab);
    } catch {
      const fallbackFeature =
        tab === 'visual_map' ? 'floor_map' : tab === 'multi_floor' ? 'multi_floor' : 'banquet_management';
      triggerLockedFeature(fallbackFeature);
    }
  };

  const handleCreateFloorZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneNameInput.trim()) return;
    const res = await fetch(`/api/workspace/${restaurantId}/floor-zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify({ name: zoneNameInput, floorLevel: zoneFloorLevelInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) triggerLockedFeature(locked);
      return;
    }
    setServerZones(data.zones || []);
    setZoneNameInput('');
  };

  const handleCreateBanquet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banquetTitle.trim() || !banquetHost.trim()) return;
    const res = await fetch(`/api/workspace/${restaurantId}/banquets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify({
        title: banquetTitle,
        hostName: banquetHost,
        guestCount: Number(banquetGuests) || 50,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) triggerLockedFeature(locked);
      return;
    }
    setBanquets(data.banquets || []);
    setBanquetTitle('');
    setBanquetHost('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    const cleanNumber = newTableNum.trim().replace(/^Table\s*/i, '');
    onAddTable({
      number: cleanNumber,
      name: newTableNum.trim().toLowerCase().startsWith('table') ? newTableNum.trim() : `Table ${cleanNumber}`,
      capacity: Number(newCapacity) || 4,
      zone: newZone,
      status: 'available',
      secureToken: `tok-tbl-${Date.now().toString(36)}`,
      activeDinersCount: 0,
      lastActivityAt: Date.now(),
    });
    setNewTableNum('');
    setIsAddingTable(false);
  };

  return (
    <div className="space-y-4">
      <UpgradePromptModal
        lockedError={lockedPrompt}
        onClose={() => setLockedPrompt(null)}
        onViewPlans={(planId) => onOpenBillingPlans && onOpenBillingPlans(planId)}
      />

      {/* Header bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold font-heading text-[#18181B] flex items-center gap-2">
            <span>Floor &amp; Table Management</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAFAFA] border border-[#E4E4E7] text-[#52525B]">
              {tables.length} Tables
            </span>
          </h2>
          <p className="text-xs text-[#71717A]">
            Basic table list &amp; QR codes on Flex; unlock visual floor map, multi-floor zones &amp; banquets as you grow
          </p>
        </div>

        {/* Sub-view Switcher & Add Table */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFloorSubView('tables')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              floorSubView === 'tables' ? 'bg-[#18181B] text-white border-[#18181B]' : 'bg-white border-[#E4E4E7]'
            }`}
          >
            Table List
          </button>
          <button
            type="button"
            onClick={() => handleOpenGatedTab('visual_map')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 ${
              floorSubView === 'visual_map' ? 'bg-[#18181B] text-white border-[#18181B]' : 'bg-white border-[#E4E4E7]'
            }`}
          >
            {!hasFeature('floor_map') && <Lock size={11} className="text-[#F76707]" />}
            <LayoutGrid size={12} />
            <span>Visual Floor Map</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenGatedTab('multi_floor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 ${
              floorSubView === 'multi_floor' ? 'bg-[#18181B] text-white border-[#18181B]' : 'bg-white border-[#E4E4E7]'
            }`}
          >
            {!hasFeature('multi_floor') && <Lock size={11} className="text-[#F76707]" />}
            <Layers size={12} />
            <span>Multi-Floor Zones</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenGatedTab('banquets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 ${
              floorSubView === 'banquets' ? 'bg-[#18181B] text-white border-[#18181B]' : 'bg-white border-[#E4E4E7]'
            }`}
          >
            {!hasFeature('banquet_management') && <Lock size={11} className="text-[#F76707]" />}
            <Sparkles size={12} />
            <span>Banquets</span>
          </button>

          <button
            onClick={() => setIsAddingTable(true)}
            className="px-3 py-1.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-1 shadow-xs transition-all"
          >
            <Plus size={14} />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Add Table Dialog (Core Basic Table Management - open on all plans) */}
      {isAddingTable && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white p-4 rounded-2xl border border-[#F76707]/30 shadow-md flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="text-[11px] font-bold text-[#71717A] block mb-1">Table #:</label>
            <input
              type="text"
              required
              value={newTableNum}
              onChange={(e) => setNewTableNum(e.target.value)}
              placeholder="e.g. 01"
              className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] text-xs font-bold w-24"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#71717A] block mb-1">Capacity:</label>
            <select
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] text-xs font-bold bg-white"
            >
              <option value="2">2 Guests</option>
              <option value="4">4 Guests</option>
              <option value="6">6 Guests</option>
              <option value="8">8 Guests</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#71717A] block mb-1">Zone:</label>
            <select
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] text-xs font-bold bg-white"
            >
              <option value="Courtyard Verandah">Courtyard Verandah</option>
              <option value="Main Dining Hall">Main Dining Hall</option>
              <option value="AC Family Lounge">AC Family Lounge</option>
              <option value="Terrace Starlight Deck">Terrace Starlight Deck</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#18181B] text-white text-xs font-bold">
              Save Table
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTable(false)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* MULTI-FLOOR ZONES VIEW (Professional+) */}
      {floorSubView === 'multi_floor' && (
        <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-4">
          <h3 className="text-sm font-extrabold font-heading">Multi-Floor &amp; Dining Zones</h3>
          <form onSubmit={handleCreateFloorZone} className="flex flex-wrap gap-2 text-xs">
            <input
              type="text"
              value={zoneNameInput}
              onChange={(e) => setZoneNameInput(e.target.value)}
              placeholder="Zone name (e.g. Rooftop Lounge)"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-[#E4E4E7]"
            />
            <input
              type="text"
              value={zoneFloorLevelInput}
              onChange={(e) => setZoneFloorLevelInput(e.target.value)}
              placeholder="Floor level (e.g. 2nd Floor)"
              className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#F76707] text-white font-bold">
              + Create Zone
            </button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {serverZones.map((z) => (
              <div key={z.id} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold">{z.name}</div>
                  <div className="text-[11px] text-[#71717A]">{z.floorLevel} • {z.capacity} seats</div>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/workspace/${restaurantId}/floor-zones/${z.id}`, {
                      method: 'DELETE',
                      headers: buildAuthHeaders(ownerToken),
                    });
                    const d = await res.json();
                    if (res.ok) setServerZones(d.zones || []);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BANQUETS VIEW (Professional+) */}
      {floorSubView === 'banquets' && (
        <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-4">
          <h3 className="text-sm font-extrabold font-heading">Banquet &amp; Private Event Bookings</h3>
          <form onSubmit={handleCreateBanquet} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              value={banquetTitle}
              onChange={(e) => setBanquetTitle(e.target.value)}
              placeholder="Event title (e.g. Corporate Dinner)"
              className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
            />
            <input
              type="text"
              value={banquetHost}
              onChange={(e) => setBanquetHost(e.target.value)}
              placeholder="Host name"
              className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
            />
            <input
              type="number"
              value={banquetGuests}
              onChange={(e) => setBanquetGuests(e.target.value)}
              placeholder="Guests"
              className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#F76707] text-white font-bold">
              + Book Banquet
            </button>
          </form>
          <div className="space-y-2">
            {banquets.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold">{b.title} • {b.hallName}</div>
                  <div className="text-[11px] text-[#71717A]">Host: {b.hostName} • {b.guestCount} guests • {b.eventDate}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STANDARD TABLE LIST & VISUAL FLOOR MAP */}
      {(floorSubView === 'tables' || floorSubView === 'visual_map') && (
        <>
          <div className="flex items-center justify-between gap-2">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-xs font-bold text-[#18181B]"
            >
              <option value="all">All Floor Zones</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredTables.map((tbl) => {
              const badge = getStatusBadge(tbl.status);
              const hasPendingWaiter = waiterRequests.some(
                (r) => r.tableNumber === tbl.number && r.status === 'pending'
              );
              const currentOrder = orders.find(
                (o) => o.tableNumber === tbl.number && o.status !== 'served' && o.status !== 'cancelled'
              );

              return (
                <div
                  key={tbl.id}
                  onClick={() => onSelectTable(tbl)}
                  className={`bg-white rounded-2xl p-3.5 border-2 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                    tbl.status === 'new_order'
                      ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                      : hasPendingWaiter
                      ? 'border-[#F76707] ring-2 ring-[#F76707]/20'
                      : 'border-[#E4E4E7] hover:border-[#D4D4D8]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-base font-extrabold font-heading text-[#18181B]">
                        Table {tbl.number}
                      </span>
                      <div className="text-[10px] text-[#71717A] truncate max-w-[100px]">{tbl.zone}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTableQr(tbl);
                      }}
                      className="p-1 rounded-lg bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B]"
                      title="View Table QR"
                    >
                      <QrCode size={14} />
                    </button>
                  </div>

                  <div>
                    <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.bg}`}>
                      {hasPendingWaiter ? '🔔 Paged Waiter' : badge.label}
                    </span>
                    {currentOrder && (
                      <div className="mt-1 text-[11px] font-bold text-[#18181B] tnum">
                        Order: {formatINR(currentOrder.grandTotal)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F4F4F5] text-[11px] text-[#71717A]">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      <span>{tbl.capacity} Seats</span>
                    </span>

                    <select
                      value={tbl.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (!hasFeature('table_management')) {
                          triggerLockedFeature('table_management');
                          return;
                        }
                        onUpdateTableStatus(tbl.id, e.target.value as TableStatus);
                      }}
                      className="text-[10px] font-bold bg-[#F4F4F5] border-0 rounded-md px-1 py-0.5 text-[#18181B]"
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="needs_cleaning">Cleaning</option>
                      <option value="bill_requested">Bill Req</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
