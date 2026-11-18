import React, { useState } from 'react';
import {
  TrendingUp,
  LayoutGrid,
  Utensils,
  QrCode,
  FileText,
  ShieldCheck,
  Building2,
  ExternalLink,
  ChevronRight,
  Store,
} from 'lucide-react';
import {
  Order,
  RestaurantTable,
  MenuCategory,
  MenuItem,
  WaiterRequest,
  RestaurantTenant,
  TableStatus,
} from '../../types/dcc';
import { DashboardOverview } from './DashboardOverview';
import { FloorManagementView } from './FloorManagementView';
import { MenuManagementView } from './MenuManagementView';
import { QrCodeManagerView } from './QrCodeManagerView';

export type OwnerTab = 'dashboard' | 'floor' | 'menu' | 'qr';

interface OwnerPortalViewProps {
  restaurant: RestaurantTenant;
  orders: Order[];
  tables: RestaurantTable[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  waiterRequests: WaiterRequest[];
  onToggleItemAvailability: (id: string) => void;
  onUpdateItemPrice: (id: string, price: number) => void;
  onAddItem: (item: Partial<MenuItem>) => void;
  onDeleteItem: (id: string) => void;
  onUpdateTableStatus: (tableId: string, status: TableStatus) => void;
  onAddTable: (table: Partial<RestaurantTable>) => void;
  onRegenerateTableToken: (tableId: string) => void;
  onOpenCustomerTable: (tableNumber: string) => void;
  onOpenConsultantModal: () => void;
  onOpenCreateRestaurant: () => void;
}

export const OwnerPortalView: React.FC<OwnerPortalViewProps> = ({
  restaurant,
  orders,
  tables,
  categories,
  menuItems,
  waiterRequests,
  onToggleItemAvailability,
  onUpdateItemPrice,
  onAddItem,
  onDeleteItem,
  onUpdateTableStatus,
  onAddTable,
  onRegenerateTableToken,
  onOpenCustomerTable,
  onOpenConsultantModal,
  onOpenCreateRestaurant,
}) => {
  const [activeTab, setActiveTab] = useState<OwnerTab>('dashboard');
  const [selectedQrTableNumber, setSelectedQrTableNumber] = useState<string>('01');

  const tabs = [
    { id: 'dashboard', label: 'Sales & Analytics', icon: TrendingUp },
    { id: 'floor', label: 'Floor Plan & Tables', icon: LayoutGrid, badge: tables.filter(t => t.status !== 'available').length },
    { id: 'menu', label: 'Menu & Stock (86\'d)', icon: Utensils, badge: menuItems.filter(i => !i.isAvailable).length },
    { id: 'qr', label: 'Table QR Stands', icon: QrCode },
  ];

  return (
    <div className="space-y-5">
      {/* OWNER PORTAL HEADER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#18181B] text-white">
              Restaurant Owner & General Manager Console
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-600" />
              <span>Multi-Tenant Isolated Workspace</span>
            </span>
          </div>
          <h1 className="text-xl font-extrabold font-heading text-[#18181B] mt-1.5 flex items-center gap-2">
            <Building2 size={20} className="text-[#F76707]" />
            <span>{restaurant.name}</span>
          </h1>
          <p className="text-xs text-[#71717A] mt-0.5">
            GSTIN: <span className="font-mono text-[#18181B]">{restaurant.gstin}</span> • FSSAI Lic: <span className="font-mono text-[#18181B]">{restaurant.fssaiLic}</span> • Location: {restaurant.address}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={onOpenCreateRestaurant}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading transition-all shadow-xs"
          >
            <Building2 size={14} />
            <span>Setup Restaurant Profile</span>
          </button>
          <button
            onClick={onOpenConsultantModal}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF4ED] hover:bg-[#FFE8D9] text-[#A14000] border border-[#F76707]/30 text-xs font-bold font-heading transition-all shadow-xs"
          >
            <FileText size={14} className="text-[#F76707]" />
            <span>Consultant ROI Audit</span>
          </button>
        </div>
      </div>

      {/* OWNER SUB-TABS NAVIGATION */}
      <div className="bg-white p-1.5 rounded-2xl border border-[#E4E4E7] shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as OwnerTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-heading whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[#F76707]' : 'text-[#71717A]'} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-[#F76707] text-white' : 'bg-[#E4E4E7] text-[#18181B]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OWNER TAB CONTENT */}
      <div>
        {activeTab === 'dashboard' && (
          <DashboardOverview
            orders={orders}
            tables={tables}
            onNavigateTo={(view) => {
              if (view === 'floor') setActiveTab('floor');
              if (view === 'menu') setActiveTab('menu');
              if (view === 'qr') setActiveTab('qr');
            }}
          />
        )}

        {activeTab === 'floor' && (
          <FloorManagementView
            tables={tables}
            orders={orders}
            waiterRequests={waiterRequests}
            onSelectTable={(tbl) => {
              onOpenCustomerTable(tbl.number);
            }}
            onUpdateTableStatus={onUpdateTableStatus}
            onAddTable={onAddTable}
            onOpenTableQr={(tbl) => {
              setSelectedQrTableNumber(tbl.number);
              setActiveTab('qr');
            }}
          />
        )}

        {activeTab === 'menu' && (
          <MenuManagementView
            categories={categories}
            items={menuItems}
            onToggleItemAvailability={onToggleItemAvailability}
            onUpdateItemPrice={onUpdateItemPrice}
            onAddItem={onAddItem}
            onDeleteItem={onDeleteItem}
          />
        )}

        {activeTab === 'qr' && (
          <QrCodeManagerView
            restaurant={restaurant}
            tables={tables}
            initialTableNumber={selectedQrTableNumber}
            onRegenerateTableToken={onRegenerateTableToken}
            onOpenCustomerViewForTable={(tblNum) => {
              onOpenCustomerTable(tblNum);
            }}
          />
        )}
      </div>
    </div>
  );
};
