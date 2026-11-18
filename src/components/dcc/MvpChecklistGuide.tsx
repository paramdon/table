import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RotateCcw,
  Play,
  Smartphone,
  ChefHat,
  Bell,
  Building2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { RestaurantTenant, RestaurantTable, Order, OrderStatus } from '../../types/dcc';

interface MvpChecklistGuideProps {
  restaurant: RestaurantTenant;
  tables: RestaurantTable[];
  orders: Order[];
  activeRole: string;
  selectedTableNumber: string;
  onOpenCreateRestaurant: () => void;
  onCreateTable01: () => void;
  onSelectRole: (role: any) => void;
  onSelectTable: (tblNum: string) => void;
  onQuickOrderTwoDishes: () => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export const MvpChecklistGuide: React.FC<MvpChecklistGuideProps> = ({
  restaurant,
  tables,
  orders,
  activeRole,
  selectedTableNumber,
  onOpenCreateRestaurant,
  onCreateTable01,
  onSelectRole,
  onSelectTable,
  onQuickOrderTwoDishes,
  onUpdateOrderStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Detect state for Table 01
  const hasTable01 = tables.some(
    (t) => t.number === '01' || t.number === '1' || t.name.includes('01')
  );

  const table01Order = orders.find(
    (o) => o.tableNumber === '01' || o.tableNumber === '1' || o.tableNumber.includes('01')
  );

  // Criteria
  const step1 = Boolean(restaurant.name && restaurant.gstin);
  const step2 = hasTable01;
  const step3 = hasTable01; // QR automatically generated for all tables
  const step4 = activeRole === 'customer' && (selectedTableNumber === '01' || selectedTableNumber === '1');
  const step5 = Boolean(table01Order && table01Order.items.length >= 2);
  const step6 = Boolean(table01Order);
  const step7 = Boolean(
    table01Order && ['preparing', 'ready', 'served'].includes(table01Order.status)
  );
  const step8 = Boolean(
    table01Order &&
      ['preparing', 'ready', 'served'].includes(table01Order.status) &&
      activeRole === 'customer'
  );
  const step9 = Boolean(table01Order && ['ready', 'served'].includes(table01Order.status));
  const step10 = Boolean(activeRole === 'waiter' && table01Order);

  const steps = [
    {
      id: 1,
      title: 'Restaurant owner creates a restaurant',
      passed: step1,
      action: () => {
        onSelectRole('owner');
        onOpenCreateRestaurant();
      },
      actionLabel: 'Setup Restaurant',
    },
    {
      id: 2,
      title: 'Owner creates Table 01',
      passed: step2,
      action: () => {
        onSelectRole('owner');
        onCreateTable01();
      },
      actionLabel: hasTable01 ? 'Table 01 Exists' : 'Create Table 01',
    },
    {
      id: 3,
      title: 'QR code is generated',
      passed: step3,
      action: () => {
        onSelectRole('owner');
      },
      actionLabel: 'View Stand QR',
    },
    {
      id: 4,
      title: 'Customer scans QR',
      passed: step4,
      action: () => {
        onSelectTable(hasTable01 ? (tables.find(t => t.number === '01' || t.number === '1')?.number || '01') : '01');
        onSelectRole('customer');
      },
      actionLabel: 'Open Table 01 Menu',
    },
    {
      id: 5,
      title: 'Customer orders two dishes',
      passed: step5,
      action: () => {
        onSelectTable(hasTable01 ? (tables.find(t => t.number === '01' || t.number === '1')?.number || '01') : '01');
        onSelectRole('customer');
        onQuickOrderTwoDishes();
      },
      actionLabel: step5 ? '2 Dishes Ordered' : 'Order 2 Dishes',
    },
    {
      id: 6,
      title: 'Kitchen receives the order without refreshing',
      passed: step6,
      action: () => {
        onSelectRole('kitchen');
      },
      actionLabel: 'Check Kitchen KDS',
    },
    {
      id: 7,
      title: 'Kitchen marks it Preparing',
      passed: step7,
      action: () => {
        if (table01Order) {
          onUpdateOrderStatus(table01Order.id, 'preparing');
        }
        onSelectRole('kitchen');
      },
      actionLabel: step7 ? 'Preparing Active' : 'Mark Preparing',
    },
    {
      id: 8,
      title: 'Customer sees the updated status',
      passed: step8,
      action: () => {
        onSelectTable(hasTable01 ? (tables.find(t => t.number === '01' || t.number === '1')?.number || '01') : '01');
        onSelectRole('customer');
      },
      actionLabel: 'View Diner Status',
    },
    {
      id: 9,
      title: 'Kitchen marks it Ready',
      passed: step9,
      action: () => {
        if (table01Order) {
          onUpdateOrderStatus(table01Order.id, 'ready');
        }
        onSelectRole('kitchen');
      },
      actionLabel: step9 ? 'Dish Ready' : 'Mark Ready',
    },
    {
      id: 10,
      title: 'Waiter sees the order',
      passed: step10,
      action: () => {
        onSelectRole('waiter');
      },
      actionLabel: 'Open Waiter Station',
    },
  ];

  const passedCount = steps.filter((s) => s.passed).length;
  const allPassed = passedCount === 10;

  return (
    <div className="bg-white border-b border-[#E4E4E7] shadow-xs">
      {/* Top Banner Toggle */}
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
              allPassed ? 'bg-[#16A34A] text-white' : 'bg-[#F76707] text-white'
            }`}
          >
            {allPassed ? '✓' : `${passedCount}`}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-heading text-[#18181B]">
              MVP Acceptance Test Tracker:
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                allPassed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {passedCount} of 10 Requirements Passed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#52525B] hover:text-[#18181B] bg-[#F4F4F5] px-2.5 py-1 rounded-lg transition-all"
          >
            <span>{isExpanded ? 'Hide Test Checklist' : 'Show Test Checklist'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Checklist Drawer */}
      {isExpanded && (
        <div className="border-t border-[#F4F4F5] bg-[#FAFAFA] p-3 max-w-7xl mx-auto animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                  s.passed
                    ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#16A34A]'
                    : 'bg-white border-[#E4E4E7] text-[#18181B]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {s.passed ? (
                      <CheckCircle2 size={15} className="text-[#16A34A] shrink-0" />
                    ) : (
                      <Circle size={15} className="text-[#A1A1AA] shrink-0" />
                    )}
                    <span className="text-[11px] leading-tight">
                      Step {s.id}: {s.title}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={s.action}
                  className={`mt-2 w-full py-1 px-2 rounded-lg text-[10px] font-bold font-heading flex items-center justify-center gap-1 transition-all ${
                    s.passed
                      ? 'bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#15803D]'
                      : 'bg-[#18181B] hover:bg-[#27272A] text-white shadow-2xs'
                  }`}
                >
                  <span>{s.actionLabel}</span>
                  <ArrowRight size={10} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#E4E4E7] flex flex-wrap items-center justify-between text-[11px] text-[#71717A] gap-2">
            <span>
              💡 <strong>Tip:</strong> Click each step button to walk through the real-time simulation or test manually in separate browser tabs!
            </span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <ShieldCheck size={13} />
              Open standard digital dining
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
