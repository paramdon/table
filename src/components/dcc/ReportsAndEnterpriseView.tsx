import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  KeyRound,
  Building2,
  Palette,
  PlugZap,
  BarChart3,
  PackageCheck,
  Plus,
  Copy,
  Check,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  buildAuthHeaders,
  parseFeatureLockedPayload,
  useEntitlements,
} from '../../hooks/useEntitlements';
import { LockedFeatureBanner, UpgradePromptModal } from './UpgradePromptModal';

interface ReportsAndEnterpriseViewProps {
  restaurantId: string;
  ownerToken?: string;
  onOpenBillingPlans: (recommendedPlanId?: string) => void;
}

export const ReportsAndEnterpriseView: React.FC<ReportsAndEnterpriseViewProps> = ({
  restaurantId,
  ownerToken,
  onOpenBillingPlans,
}) => {
  const {
    hasFeature,
    plan,
    lockedPrompt,
    setLockedPrompt,
    triggerLockedFeature,
    refresh: refreshEntitlements,
  } = useEntitlements(restaurantId, ownerToken);

  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'api' | 'enterprise'>('reports');
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [zonePerf, setZonePerf] = useState<any[]>([]);
  const [staffActivity, setStaffActivity] = useState<any[]>([]);
  const [inventoryInsights, setInventoryInsights] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Enterprise state
  const [branches, setBranches] = useState<any[]>([]);
  const [branchName, setBranchName] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchManager, setBranchManager] = useState('');
  const [whiteLabel, setWhiteLabel] = useState<any>({
    brandName: '',
    primaryColor: '#F76707',
    customDomain: '',
    hidePoweredByDcc: false,
  });
  const [posErp, setPosErp] = useState<any>({
    posProvider: 'none',
    posWebhookUrl: '',
    posSyncEnabled: false,
    erpProvider: 'none',
    erpEndpointUrl: '',
    erpSyncEnabled: false,
  });
  const [notice, setNotice] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const loadSectionData = useCallback(async () => {
    const headers = buildAuthHeaders(ownerToken);

    if (hasFeature('weekly_reports')) {
      const r = await fetch(`/api/reports/${restaurantId}/weekly`, { headers });
      const d = await r.json();
      if (r.ok && d.success) setWeeklyReport(d);
    }

    if (hasFeature('financial_exports')) {
      const [zRes, sRes] = await Promise.all([
        fetch(`/api/reports/${restaurantId}/zone-performance`, { headers }),
        fetch(`/api/reports/${restaurantId}/staff-activity`, { headers }),
      ]);
      const zData = await zRes.json();
      const sData = await sRes.json();
      if (zRes.ok && zData.success) setZonePerf(zData.zones || []);
      if (sRes.ok && sData.success) setStaffActivity(sData.staffActivity || []);
    }

    if (hasFeature('inventory_insights')) {
      const iRes = await fetch(`/api/reports/${restaurantId}/inventory-insights`, { headers });
      const iData = await iRes.json();
      if (iRes.ok && iData.success) setInventoryInsights(iData);
    }

    if (hasFeature('api_access')) {
      const kRes = await fetch(`/api/integrations/${restaurantId}/api-keys`, { headers });
      const kData = await kRes.json();
      if (kRes.ok && kData.success) setApiKeys(kData.apiKeys || []);
    }

    if (hasFeature('multi_branch')) {
      const bRes = await fetch(`/api/enterprise/${restaurantId}/branches`, { headers });
      const bData = await bRes.json();
      if (bRes.ok && bData.success) setBranches(bData.branches || []);
    }

    if (hasFeature('white_label')) {
      const wRes = await fetch(`/api/enterprise/${restaurantId}/white-label`, { headers });
      const wData = await wRes.json();
      if (wRes.ok && wData.success && wData.config) setWhiteLabel(wData.config);
    }

    if (hasFeature('pos_integration')) {
      const pRes = await fetch(`/api/enterprise/${restaurantId}/pos-erp`, { headers });
      const pData = await pRes.json();
      if (pRes.ok && pData.success && pData.config) setPosErp(pData.config);
    }
  }, [restaurantId, ownerToken, hasFeature]);

  useEffect(() => {
    refreshEntitlements();
  }, [refreshEntitlements]);

  useEffect(() => {
    loadSectionData();
  }, [loadSectionData]);

  const handleDownloadFinancialCsv = async () => {
    const res = await fetch(`/api/reports/${restaurantId}/financial-export?format=csv`, {
      headers: buildAuthHeaders(ownerToken),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const locked = parseFeatureLockedPayload(errData);
      if (locked) return triggerLockedFeature(locked);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dcc-financial-report-${restaurantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await fetch(`/api/integrations/${restaurantId}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) return triggerLockedFeature(locked);
      return;
    }
    setCreatedPlainKey(data.plainTextKey);
    setApiKeys(data.apiKeys || []);
    setNewKeyName('');
    flashNotice('API key created! Copy the secret now.');
  };

  const handleRevokeApiKey = async (keyId: string) => {
    const res = await fetch(`/api/integrations/${restaurantId}/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(ownerToken),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setApiKeys(data.apiKeys || []);
      flashNotice('API key revoked.');
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    const res = await fetch(`/api/enterprise/${restaurantId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify({ name: branchName, city: branchCity, managerName: branchManager }),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) return triggerLockedFeature(locked);
      return;
    }
    setBranches(data.branches || []);
    setBranchName('');
    setBranchCity('');
    setBranchManager('');
    flashNotice('Branch added to centralized dashboard.');
  };

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/enterprise/${restaurantId}/white-label`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify(whiteLabel),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) return triggerLockedFeature(locked);
      return;
    }
    setWhiteLabel(data.config);
    flashNotice('White-label branding & custom domain saved.');
  };

  const handleSavePosErp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/enterprise/${restaurantId}/pos-erp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(ownerToken) },
      body: JSON.stringify(posErp),
    });
    const data = await res.json();
    if (!res.ok) {
      const locked = parseFeatureLockedPayload(data);
      if (locked) return triggerLockedFeature(locked);
      return;
    }
    setPosErp(data.config);
    flashNotice('POS & ERP integration settings saved.');
  };

  return (
    <div className="space-y-4">
      <UpgradePromptModal
        lockedError={lockedPrompt}
        onClose={() => setLockedPrompt(null)}
        onViewPlans={onOpenBillingPlans}
      />

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">
          {notice}
        </div>
      )}

      {/* Sub-navigation */}
      <div className="bg-white p-2 rounded-2xl border border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'reports', label: 'Weekly & Financial Reports', icon: BarChart3 },
            { id: 'api', label: 'API & Webhooks', icon: KeyRound },
            { id: 'enterprise', label: 'Multi-Branch, White-Label & POS', icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-[#18181B] text-white'
                    : 'text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => loadSectionData()}
          className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] text-xs font-bold flex items-center gap-1 text-[#52525B] hover:bg-[#FAFAFA]"
        >
          <RefreshCw size={12} />
          <span>Refresh</span>
        </button>
      </div>

      {/* REPORTS TAB */}
      {activeSubTab === 'reports' && (
        <div className="space-y-4">
          {!hasFeature('weekly_reports') ? (
            <LockedFeatureBanner
              title="Weekly Sales & Billing Reports"
              description="Unlock structured 7-day revenue summaries, order velocity, and weekly commission breakdowns."
              requiredPlanName="Essential"
              requiredPlanPriceInr={1999}
              currentPlanName={plan.name}
              onUpgradeClick={() => triggerLockedFeature('weekly_reports')}
            />
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                    Weekly Sales &amp; Billing Statement (Last 7 Days)
                  </h3>
                  <p className="text-xs text-[#71717A]">Live persisted totals from kitchen &amp; payment ledger</p>
                </div>
                <button
                  onClick={handleDownloadFinancialCsv}
                  className="px-3.5 py-2 rounded-xl bg-[#18181B] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Export Financial CSV</span>
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]">
                  <span className="text-[11px] text-[#71717A]">Active Orders (7d)</span>
                  <div className="text-xl font-extrabold text-[#18181B]">{weeklyReport?.ordersCount ?? 0}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]">
                  <span className="text-[11px] text-[#71717A]">Gross Paid Sales</span>
                  <div className="text-xl font-extrabold text-[#16A34A]">
                    ₹{(weeklyReport?.grossSales ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]">
                  <span className="text-[11px] text-[#71717A]">Eligible Food Subtotal</span>
                  <div className="text-xl font-extrabold text-[#18181B]">
                    ₹{(weeklyReport?.eligibleSubtotal ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7]">
                  <span className="text-[11px] text-[#71717A]">Avg Order Value</span>
                  <div className="text-xl font-extrabold text-[#F76707]">
                    ₹{(weeklyReport?.averageOrderValue ?? 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hasFeature('financial_exports') ? (
            <LockedFeatureBanner
              title="Advanced Financial Exports, Zone & Staff Reports"
              description="Analyze performance per dining zone, audit staff login activity, and export itemized commission & tax CSV reports."
              requiredPlanName="Professional"
              requiredPlanPriceInr={4999}
              currentPlanName={plan.name}
              onUpgradeClick={() => triggerLockedFeature('financial_exports')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-[#F76707]" />
                  <h4 className="text-sm font-extrabold font-heading text-[#18181B]">
                    Dining Zone Performance
                  </h4>
                </div>
                <div className="space-y-2">
                  {zonePerf.map((z) => (
                    <div
                      key={z.zone}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#18181B]">{z.zone}</div>
                        <div className="text-[11px] text-[#71717A]">
                          {z.tablesCount} tables • {z.ordersCount} orders
                        </div>
                      </div>
                      <div className="font-extrabold text-[#16A34A]">
                        ₹{Math.round(z.revenue).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                  {zonePerf.length === 0 && (
                    <p className="text-xs text-[#71717A]">No zone activity recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-3">
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className="text-blue-600" />
                  <h4 className="text-sm font-extrabold font-heading text-[#18181B]">
                    Staff Activity &amp; Inventory Insights
                  </h4>
                </div>
                {inventoryInsights && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-base font-extrabold text-emerald-700">
                        {inventoryInsights.inStockCount}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold">In Stock</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-base font-extrabold text-amber-700">
                        {inventoryInsights.lowStockItems?.length || 0}
                      </div>
                      <div className="text-[10px] text-amber-700 font-bold">Low Stock</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-base font-extrabold text-red-700">
                        {inventoryInsights.soldOutItems?.length || 0}
                      </div>
                      <div className="text-[10px] text-red-700 font-bold">Sold Out</div>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {staffActivity.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FAFAFA] text-xs"
                    >
                      <span className="font-bold text-[#18181B]">
                        {s.name} <span className="text-[#71717A] font-normal">({s.role})</span>
                      </span>
                      <span className="text-[11px] font-semibold text-[#52525B]">
                        {s.eventsCount} security events
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* API KEYS TAB */}
      {activeSubTab === 'api' && (
        <div>
          {!hasFeature('api_access') ? (
            <LockedFeatureBanner
              title="REST API Integrations & Keys"
              description="Generate scoped API keys to connect external reporting tools, accounting software, or kitchen automations."
              requiredPlanName="Professional"
              requiredPlanPriceInr={4999}
              currentPlanName={plan.name}
              onUpgradeClick={() => triggerLockedFeature('api_access')}
            />
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-4">
              <div>
                <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                  API Keys &amp; Integrations
                </h3>
                <p className="text-xs text-[#71717A]">
                  Persisted per-restaurant keys scoped strictly to your workspace.
                </p>
              </div>

              {createdPlainKey && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="text-xs font-bold text-amber-900">
                    Copy your new secret key now (shown once):
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-mono select-all">
                      {createdPlainKey}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdPlainKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#18181B] text-white text-xs font-bold flex items-center gap-1"
                    >
                      {copiedKey ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateApiKey} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key label (e.g. Tally Accounting Sync)"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F76707] text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Generate Key</span>
                </button>
              </form>

              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#18181B]">{k.name}</div>
                      <div className="text-[11px] font-mono text-[#71717A]">{k.prefix}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          k.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {k.status}
                      </span>
                      {k.status === 'active' && (
                        <button
                          onClick={() => handleRevokeApiKey(k.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Revoke API key"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <p className="text-xs text-[#71717A]">No API keys generated yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENTERPRISE TAB */}
      {activeSubTab === 'enterprise' && (
        <div className="space-y-4">
          {!hasFeature('multi_branch') ? (
            <LockedFeatureBanner
              title="Enterprise Multi-Branch, White-Label & POS/ERP Suite"
              description="Manage multiple restaurant outlets centrally, configure custom domains & white-label guest menus, and integrate POS/ERP pipelines with 0% commission."
              requiredPlanName="Enterprise"
              requiredPlanPriceInr={9999}
              currentPlanName={plan.name}
              onUpgradeClick={() => triggerLockedFeature('multi_branch')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Multi-Branch */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#F76707]" />
                  <h4 className="text-sm font-extrabold font-heading">Multi-Branch Outlets</h4>
                </div>
                <form onSubmit={handleAddBranch} className="space-y-2 text-xs">
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="Branch name (e.g. Indiranagar Flagship)"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={branchCity}
                      onChange={(e) => setBranchCity(e.target.value)}
                      placeholder="City"
                      className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
                    />
                    <input
                      type="text"
                      value={branchManager}
                      onChange={(e) => setBranchManager(e.target.value)}
                      placeholder="Manager"
                      className="px-3 py-2 rounded-xl border border-[#E4E4E7]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-[#18181B] text-white font-bold"
                  >
                    + Add Branch
                  </button>
                </form>
                <div className="space-y-1.5">
                  {branches.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-xs">
                      <div className="font-bold">{b.name}</div>
                      <div className="text-[11px] text-[#71717A]">
                        {b.city || 'Main City'} • Mgr: {b.managerName || 'Assigned'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* White-label */}
              <form
                onSubmit={handleSaveWhiteLabel}
                className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Palette size={16} className="text-purple-600" />
                  <h4 className="text-sm font-extrabold font-heading">White-Label &amp; Custom Domain</h4>
                </div>
                <div>
                  <label className="font-bold block mb-1">Custom Brand Name</label>
                  <input
                    type="text"
                    value={whiteLabel.brandName || ''}
                    onChange={(e) => setWhiteLabel({ ...whiteLabel, brandName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Custom Domain</label>
                  <input
                    type="text"
                    value={whiteLabel.customDomain || ''}
                    onChange={(e) => setWhiteLabel({ ...whiteLabel, customDomain: e.target.value })}
                    placeholder="order.yourrestaurant.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] font-mono"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(whiteLabel.hidePoweredByDcc)}
                    onChange={(e) => setWhiteLabel({ ...whiteLabel, hidePoweredByDcc: e.target.checked })}
                    className="accent-[#F76707]"
                  />
                  <span className="font-medium">Hide &ldquo;Powered by d.cc&rdquo; footer</span>
                </label>
                <button type="submit" className="w-full py-2 rounded-xl bg-[#F76707] text-white font-bold">
                  Save White-Label Settings
                </button>
              </form>

              {/* POS & ERP */}
              <form
                onSubmit={handleSavePosErp}
                className="bg-white p-5 rounded-2xl border border-[#E4E4E7] space-y-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <PlugZap size={16} className="text-emerald-600" />
                  <h4 className="text-sm font-extrabold font-heading">POS &amp; ERP Integrations</h4>
                </div>
                <div>
                  <label className="font-bold block mb-1">POS Provider</label>
                  <select
                    value={posErp.posProvider || 'none'}
                    onChange={(e) => setPosErp({ ...posErp, posProvider: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white"
                  >
                    <option value="none">None</option>
                    <option value="petpooja">Petpooja POS</option>
                    <option value="posist">Posist / Restroworks</option>
                    <option value="micros">Oracle Micros</option>
                    <option value="custom">Custom Webhook POS</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">ERP Provider</label>
                  <select
                    value={posErp.erpProvider || 'none'}
                    onChange={(e) => setPosErp({ ...posErp, erpProvider: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white"
                  >
                    <option value="none">None</option>
                    <option value="tally">Tally Prime</option>
                    <option value="zoho_books">Zoho Books</option>
                    <option value="sap">SAP Business One</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2 rounded-xl bg-[#18181B] text-white font-bold">
                  Save Integrations
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
