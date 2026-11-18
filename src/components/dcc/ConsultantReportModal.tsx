import React, { useState } from 'react';
import {
  X,
  FileText,
  TrendingUp,
  Cpu,
  AlertTriangle,
  Award,
  DollarSign,
  Clock,
  Users,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface ConsultantReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsultantReportModal: React.FC<ConsultantReportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ops' | 'roi' | 'tech' | 'challenges' | 'differentiation'>('ops');

  // ROI Calculator states
  const [tablesCount, setTablesCount] = useState<number>(25);
  const [avgTicket, setAvgTicket] = useState<number>(1200); // in INR
  const [dailyTurns, setDailyTurns] = useState<number>(3.5);

  // Calculations
  const monthlyRevenue = tablesCount * avgTicket * dailyTurns * 30;
  // Ur.Dear.Menu improves table turnaround by ~18 minutes (15% more covers during peak dinner rush)
  const additionalMonthlyRevenue = monthlyRevenue * 0.14;
  // Reduces floor staff burden by 40% (save 2-3 waiters salary @ ₹18,000/month = ₹54,000/mo)
  const waiterCostSavings = 2.5 * 18000;
  const netMonthlyBenefit = additionalMonthlyRevenue + waiterCostSavings;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#18181B] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F76707] flex items-center justify-center text-white font-bold shadow-md">
              <Award size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-heading">
                  Ur.Dear.Menu Restaurant Tech Consultant Audit
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F76707]/20 text-[#FFDBCC] border border-[#F76707]/30">
                  Advisory Report
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA]">
                Strategic, Financial & Architectural Analysis for Hospitality Enterprise
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E4E4E7] bg-[#FAFAFA] overflow-x-auto no-scrollbar px-6 pt-2 shrink-0">
          {[
            { id: 'ops', label: '1. Operational Impact', icon: Zap },
            { id: 'roi', label: '2. Revenue & ROI Model', icon: TrendingUp },
            { id: 'tech', label: '3. Technical Stack', icon: Cpu },
            { id: 'challenges', label: '4. Indian Market Challenges', icon: AlertTriangle },
            { id: 'differentiation', label: '5. vs Third-Party Aggregators', icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold font-heading border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#F76707] text-[#18181B] bg-white'
                    : 'border-transparent text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#F76707]' : 'text-[#71717A]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[#18181B] text-sm leading-relaxed">
          {/* TAB 1: OPERATIONS */}
          {activeTab === 'ops' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold font-heading text-[#18181B] mb-2 flex items-center gap-2">
                  <Zap size={18} className="text-[#F76707]" />
                  Operational Transformation: Traditional vs. Ur.Dear.Menu QR Ecosystem
                </h3>
                <p className="text-xs text-[#52525B]">
                  Traditional Indian fine-dining and casual bistros suffer from a 4-touchpoint waiter bottleneck: Waiting for menu → Waiting for order taking → Waiting for check/bill → Waiting for card machine or UPI QR.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#DC2626]/20 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#DC2626] flex items-center gap-1.5">
                    Traditional Restaurant Workflow (High Friction)
                  </h4>
                  <ul className="text-xs text-[#7F1D1D] space-y-2 list-disc list-inside">
                    <li><strong>Order Delay:</strong> 8-12 minutes spent waiting for an available captain during peak weekend hours.</li>
                    <li><strong>Human Error:</strong> Verbal dietary instructions ("No onions, extra crispy naan") frequently lost in translation to kitchen.</li>
                    <li><strong>Table Turnover Drag:</strong> 15-20 minutes wasted just asking for the bill, waiting for the captain to fetch the card machine, and processing slips.</li>
                    <li><strong>Lost Re-Orders:</strong> Diners hesitate to order second rounds of drinks, extra breads, or desserts because flagging down a waiter takes too long.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#16A34A]/25 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#16A34A] flex items-center gap-1.5">
                    Ur.Dear.Menu Digital Tabletop Workflow (High Velocity)
                  </h4>
                  <ul className="text-xs text-[#14532D] space-y-2 list-disc list-inside">
                    <li><strong>Instant Menu Load:</strong> Guests scan table QR; complete visual menu with high-res photos and Jain/Veg tags loads in &lt;1.2 seconds.</li>
                    <li><strong>Direct KDS Firing:</strong> Orders route immediately to the Kitchen Display System with live preparation countdowns.</li>
                    <li><strong>One-Tap Waiter Paging:</strong> Specific requests (water carafe, sirka pyaz, finger bowl) alert staff tablets with table numbers.</li>
                    <li><strong>Instant Self-Checkout:</strong> Diners view live running subtotal with GST and pay immediately via dynamic UPI QR code.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2">
                <h4 className="text-xs font-bold text-[#18181B]">Key Metric Improvements:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white rounded-xl border border-[#E4E4E7]">
                    <div className="text-lg font-extrabold text-[#F76707] font-heading">-18 mins</div>
                    <div className="text-[10px] text-[#71717A]">Avg Table Turnaround</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E4E4E7]">
                    <div className="text-lg font-extrabold text-[#16A34A] font-heading">+24%</div>
                    <div className="text-[10px] text-[#71717A]">Dessert & Beverage Re-orders</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E4E4E7]">
                    <div className="text-lg font-extrabold text-[#2563EB] font-heading">0%</div>
                    <div className="text-[10px] text-[#71717A]">Kitchen Miscommunication</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-[#E4E4E7]">
                    <div className="text-lg font-extrabold text-[#7C3AED] font-heading">4.8★</div>
                    <div className="text-[10px] text-[#71717A]">Verified Diner Rating Avg</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ROI CALCULATOR */}
          {activeTab === 'roi' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold font-heading text-[#18181B] mb-1">
                  Revenue & Cost Benefits Model
                </h3>
                <p className="text-xs text-[#52525B]">
                  Interactive financial projections based on Indian casual dine-in benchmarks (Gurugram / Bengaluru / Mumbai / Delhi NCR).
                </p>
              </div>

              {/* Calculator Inputs */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#71717A] block mb-1">Total Tables:</label>
                  <input
                    type="number"
                    value={tablesCount}
                    onChange={(e) => setTablesCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E4E4E7] rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#71717A] block mb-1">Avg Ticket Size (₹):</label>
                  <input
                    type="number"
                    value={avgTicket}
                    onChange={(e) => setAvgTicket(Math.max(100, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E4E4E7] rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#71717A] block mb-1">Daily Table Turns:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={dailyTurns}
                    onChange={(e) => setDailyTurns(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-[#E4E4E7] rounded-xl"
                  />
                </div>
              </div>

              {/* Projections Card */}
              <div className="p-5 rounded-2xl bg-[#18181B] text-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#A1A1AA] uppercase tracking-wider font-bold">Estimated Monthly Net Gain:</span>
                  <span className="text-2xl font-extrabold font-heading text-[#F76707] tnum">
                    +{formatINR(netMonthlyBenefit)} / month
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <div className="text-[#A1A1AA]">Current Monthly Revenue:</div>
                    <div className="text-sm font-bold tnum">{formatINR(monthlyRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-[#A1A1AA]">Incremental Revenue (+14% Turns):</div>
                    <div className="text-sm font-bold text-[#16A34A] tnum">+{formatINR(additionalMonthlyRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-[#A1A1AA]">Staff Optimization Savings:</div>
                    <div className="text-sm font-bold text-[#2563EB] tnum">+{formatINR(waiterCostSavings)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICAL STACK */}
          {activeTab === 'tech' && (
            <div className="space-y-4">
              <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                Production Technical Architecture for Scale
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-[#E4E4E7] bg-white space-y-1.5">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F76707]" />
                    Frontend Customer & KDS App
                  </div>
                  <p className="text-[#52525B]">
                    React 19 + TypeScript + Tailwind CSS v4. Lightweight zero-download PWA architecture (&lt;150KB bundle) that works reliably even on congested restaurant 4G/5G connections.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#E4E4E7] bg-white space-y-1.5">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    Real-time Data & PostgreSQL
                  </div>
                  <p className="text-[#52525B]">
                    Supabase PostgreSQL with Row Level Security (RLS) enforcing strict tenant isolation. Supabase Realtime (WebSockets) for millisecond kitchen ticket routing and captain paging.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#E4E4E7] bg-white space-y-1.5">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                    Payment Rail & UPI Integration
                  </div>
                  <p className="text-[#52525B]">
                    Dynamic UPI Deep-Link and high-density SVG QR generator (`upi://pay?pa=...`) connecting directly to interoperable Merchant VPAs, bank accounts, or certified UPI POS terminals with 0% MDR on UPI transactions.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[#E4E4E7] bg-white space-y-1.5">
                  <div className="font-bold text-[#18181B] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                    POS Integration Layer
                  </div>
                  <p className="text-[#52525B]">
                    REST & Webhook connectors to integrate alongside existing legacy billing systems, desktop POS terminals, and thermal KOT printers, ensuring kitchen slips print seamlessly without duplicate billings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INDIAN RESTAURANT CHALLENGES */}
          {activeTab === 'challenges' && (
            <div className="space-y-4">
              <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                Key Implementation Challenges in Indian Restaurants & Solutions
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                  <strong className="text-[#18181B] block mb-1">1. Cellular Dead Zones in Basements & Thick Concrete:</strong>
                  <p className="text-[#52525B]">
                    <em>Challenge:</em> Many Indian restaurants have indoor dining in basements or courtyard heritage structures with poor cell reception.<br />
                    <em>Ur.Dear.Menu Solution:</em> Instant Wi-Fi QR credential pass embedded directly on the table stand so guests connect to restaurant Wi-Fi in 1-tap.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                  <strong className="text-[#18181B] block mb-1">2. Non-Tech-Savvy Staff & High Attrition:</strong>
                  <p className="text-[#52525B]">
                    <em>Challenge:</em> Kitchen helpers and cleaners rotate frequently and cannot navigate complex English admin software.<br />
                    <em>Ur.Dear.Menu Solution:</em> Color-coded visual KDS cards with large touch buttons, audio sound prompts, and bilingual Hindi/English dish names.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA]">
                  <strong className="text-[#18181B] block mb-1">3. Elder Guest Reluctance to Scan QR:</strong>
                  <p className="text-[#52525B]">
                    <em>Challenge:</em> Multi-generational Indian families often prefer personal hospitality over mobile screens.<br />
                    <em>Ur.Dear.Menu Solution:</em> Hybrid dining approach. Waiters use Ur.Dear.Menu on their own handheld tablet for guests who prefer physical interaction, syncing with the same live KDS.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DIFFERENTIATION VS THIRD-PARTY AGGREGATORS */}
          {activeTab === 'differentiation' && (
            <div className="space-y-4">
              <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                Strategic Differentiation vs Third-Party Dine-in Aggregators
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E4E4E7] rounded-xl overflow-hidden">
                  <thead className="bg-[#18181B] text-white font-bold">
                    <tr>
                      <th className="p-3">Feature / Metric</th>
                      <th className="p-3 text-[#F76707]">Ur.Dear.Menu Restaurant SaaS</th>
                      <th className="p-3 text-[#71717A]">Third-Party Food Aggregators</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] bg-white text-[#52525B]">
                    <tr>
                      <td className="p-3 font-bold text-[#18181B]">Commission on Sales</td>
                      <td className="p-3 font-bold text-[#16A34A]">0% Commission (Fixed SaaS Flat Fee)</td>
                      <td className="p-3 text-[#DC2626]">8% - 15% Commission on bill</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#18181B]">Customer Data Ownership</td>
                      <td className="p-3 font-bold text-[#16A34A]">100% Restaurant Owned (Direct CRM)</td>
                      <td className="p-3 text-[#DC2626]">Aggregator owns customer relationship</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#18181B]">App Download Required</td>
                      <td className="p-3 font-bold text-[#16A34A]">No App Needed (Instant Mobile Web)</td>
                      <td className="p-3 text-[#71717A]">Must install heavy consumer app</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#18181B]">Kitchen Display System</td>
                      <td className="p-3 font-bold text-[#16A34A]">Real-time KDS with delay timers</td>
                      <td className="p-3 text-[#71717A]">Only basic payment confirmation</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#18181B]">Waiter Paging Integration</td>
                      <td className="p-3 font-bold text-[#16A34A]">Instant floor staff tablet alert</td>
                      <td className="p-3 text-[#DC2626]">Not available</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-[#E4E4E7] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs text-[#71717A]">
              Prepared for: <strong>Ur.Dear.Menu Hospitality Architecture</strong>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#16A34A]">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <span>Ur.Dear.Menu • Vendor-neutral open dining standard</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading hover:bg-[#27272A] transition-all"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
