import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Download,
  Printer,
  RefreshCw,
  Wifi,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  Link as LinkIcon,
  Plus,
  BarChart3,
  Power,
  Trash2,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { RestaurantTable, RestaurantTenant, TrackableQrCode } from '../../types/dcc';

interface QrCodeManagerViewProps {
  restaurant: RestaurantTenant;
  tables: RestaurantTable[];
  initialTableNumber?: string;
  onRegenerateTableToken: (tableId: string) => void;
  onOpenCustomerViewForTable: (tableNumber: string) => void;
  onWorkspaceRefresh?: () => void;
}

export const QrCodeManagerView: React.FC<QrCodeManagerViewProps> = ({
  restaurant,
  tables,
  initialTableNumber,
  onRegenerateTableToken,
  onWorkspaceRefresh,
}) => {
  const [trackableQrs, setTrackableQrs] = useState<TrackableQrCode[]>([]);
  const [loadingQrs, setLoadingQrs] = useState(false);

  // Generate QR Code form state
  const [tableInput, setTableInput] = useState<string>(initialTableNumber || tables[0]?.number || '01');
  const [labelInput, setLabelInput] = useState<string>('');
  const [zoneInput, setZoneInput] = useState<string>('Main Dining');
  const [capacityInput, setCapacityInput] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(() => {
    if (initialTableNumber) {
      const match = tables.find((t) => t.number === initialTableNumber);
      if (match) return match;
    }
    return tables[0] || null;
  });
  const [activeTrackableQr, setActiveTrackableQr] = useState<TrackableQrCode | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fetchTrackableQrs = useCallback(async () => {
    if (!restaurant?.id) return;
    setLoadingQrs(true);
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(restaurant.id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.qrCodes)) {
        setTrackableQrs(data.qrCodes);
      }
    } catch (e) {
      console.warn('Failed to fetch trackable QRs:', e);
    } finally {
      setLoadingQrs(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    fetchTrackableQrs();
  }, [fetchTrackableQrs]);

  useEffect(() => {
    if (initialTableNumber) {
      setTableInput(initialTableNumber);
      const match = tables.find((t) => t.number === initialTableNumber);
      if (match) setSelectedTable(match);
    } else if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0]);
      setTableInput(tables[0].number);
    }
  }, [initialTableNumber, tables, selectedTable]);

  // Match active trackable QR for currently selected table
  useEffect(() => {
    if (activeTrackableQr && selectedTable && activeTrackableQr.tableNumber === selectedTable.number) {
      return;
    }
    if (selectedTable) {
      const match = trackableQrs.find(
        (q) => q.tableNumber === selectedTable.number && q.isActive
      ) || trackableQrs.find((q) => q.tableNumber === selectedTable.number);
      setActiveTrackableQr(match || null);
    }
  }, [selectedTable, trackableQrs, activeTrackableQr]);

  // Construct exact customer menu destination URL with embedded table ID & tracking token
  const restSlug = restaurant.slug || restaurant.id;
  const cleanInput = tableInput.replace(/^Table\s*/i, '').trim();
  const paddedInput = /^\d{1,2}$/.test(cleanInput) ? cleanInput.padStart(2, '0') : cleanInput;
  const activeTableNumber = paddedInput || activeTrackableQr?.tableNumber || selectedTable?.number || '01';
  const activeTableId =
    (activeTrackableQr?.tableNumber === activeTableNumber && activeTrackableQr?.tableId) ||
    (selectedTable?.number === activeTableNumber && selectedTable?.id) ||
    `tbl-${restaurant.id}-${activeTableNumber}`;
  const activeToken =
    (activeTrackableQr?.tableNumber === activeTableNumber && activeTrackableQr?.trackingToken) ||
    (selectedTable?.number === activeTableNumber && selectedTable?.secureToken) ||
    '';

  const customerRelativePath = activeToken
    ? `/customer?restaurant=${encodeURIComponent(restSlug)}&table=${encodeURIComponent(activeTableNumber)}&tableId=${encodeURIComponent(activeTableId)}&token=${encodeURIComponent(activeToken)}`
    : `/customer?restaurant=${encodeURIComponent(restSlug)}&table=${encodeURIComponent(activeTableNumber)}&tableId=${encodeURIComponent(activeTableId)}`;

  const previewCustomerPath = `${customerRelativePath}&view=customer`;

  const fullDestinationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${customerRelativePath}`
      : customerRelativePath;

  // Render QR image whenever destination URL changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    QRCode.toDataURL(fullDestinationUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((e) => console.error('QR generation error', e));
  }, [fullDestinationUrl]);

  const handleGenerateTrackableQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableInput.trim()) return;
    setIsGenerating(true);
    setGenMessage(null);
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableNumber: tableInput.trim(),
          label: labelInput.trim() || undefined,
          zone: zoneInput.trim() || 'Main Dining',
          capacity: capacityInput,
        }),
      });
      const data = await res.json();
      if (data.success && data.qrCode) {
        setTrackableQrs(data.qrCodes || [data.qrCode, ...trackableQrs]);
        setActiveTrackableQr(data.qrCode);
        if (data.table) setSelectedTable(data.table);
        setLabelInput('');
        setGenMessage(`Generated unique trackable QR for Table ${data.qrCode.tableNumber}`);
        if (onWorkspaceRefresh) onWorkspaceRefresh();
      }
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleQr = async (qrId: string) => {
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(qrId)}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.qrCode) {
        setTrackableQrs((prev) => prev.map((q) => (q.id === qrId ? data.qrCode : q)));
        if (activeTrackableQr?.id === qrId) setActiveTrackableQr(data.qrCode);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteQr = async (qrId: string) => {
    try {
      await fetch(`/api/qr/${encodeURIComponent(qrId)}`, { method: 'DELETE' });
      setTrackableQrs((prev) => prev.filter((q) => q.id !== qrId));
      if (activeTrackableQr?.id === qrId) setActiveTrackableQr(null);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!qrDataUrl) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      // White card background with border
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      // Top header badge
      ctx.fillStyle = '#F76707';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UR.DEAR.MENU TABLETOP ORDERING', canvas.width / 2, 76);

      // Restaurant name
      ctx.fillStyle = '#18181B';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(restaurant.name.slice(0, 32), canvas.width / 2, 122);

      // Table pill
      ctx.fillStyle = '#18181B';
      ctx.fillRect(canvas.width / 2 - 130, 148, 260, 52);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`TABLE ${activeTableNumber}`, canvas.width / 2, 183);

      // QR image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = qrDataUrl;
      });
      ctx.drawImage(img, canvas.width / 2 - 220, 224, 440, 440);

      // Embedded tracking & URL footer
      ctx.fillStyle = '#18181B';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Scan with Camera to Order', canvas.width / 2, 706);

      ctx.fillStyle = '#52525B';
      ctx.font = '16px monospace';
      ctx.fillText(`Table ID: ${activeTableId}`, canvas.width / 2, 744);
      if (activeToken) {
        ctx.fillText(`Tracking Token: ${activeToken}`, canvas.width / 2, 772);
      }

      ctx.fillStyle = '#F76707';
      ctx.font = '15px monospace';
      const displayUrl = customerRelativePath.length > 62
        ? customerRelativePath.slice(0, 59) + '...'
        : customerRelativePath;
      ctx.fillText(displayUrl, canvas.width / 2, 814);

      const compositePng = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${restSlug}-table-${activeTableNumber}-qr.png`;
      link.href = compositePng;
      link.click();
    } catch {
      const link = document.createElement('a');
      link.download = `${restSlug}-table-${activeTableNumber}-qr.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  const handleCopyUrl = (urlToCopy: string = fullDestinationUrl) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(urlToCopy);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold font-heading text-[#18181B] flex flex-wrap items-center gap-2">
            <span>Tabletop QR Code Generator & Stand Manager</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/25">
              Direct Customer Menu Routing
            </span>
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Create unique, trackable table QR codes linking directly to{' '}
            <code className="font-mono text-[#F76707]">
              /customer?restaurant={restSlug}&table=...
            </code>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="px-3.5 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-xs font-bold text-[#18181B] flex items-center gap-1.5 transition-all shadow-2xs disabled:opacity-50"
          >
            <Download size={14} />
            <span>Download PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Printer size={14} />
            <span>Print Stand</span>
          </button>
        </div>
      </div>

      {/* GENERATE QR CODE UTILITY */}
      <form
        onSubmit={handleGenerateTrackableQr}
        className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#F76707] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                Generate Trackable QR Code
              </h3>
              <p className="text-[11px] text-[#71717A]">
                Select or enter any table number to mint a unique tracking token and scannable QR code
              </p>
            </div>
          </div>
          {genMessage && (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/20">
              {genMessage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-[11px] font-bold text-[#52525B] block mb-1">
              Table Number *
            </label>
            <input
              type="text"
              value={tableInput}
              onChange={(e) => {
                const next = e.target.value;
                setTableInput(next);
                const cleanNext = next.replace(/^Table\s*/i, '').trim();
                const paddedNext = /^\d{1,2}$/.test(cleanNext) ? cleanNext.padStart(2, '0') : cleanNext;
                const matchingTable = tables.find((t) => t.number === paddedNext || t.number === cleanNext);
                setSelectedTable(matchingTable || null);
                const matchingQr = trackableQrs.find((q) => (q.tableNumber === paddedNext || q.tableNumber === cleanNext) && q.isActive);
                setActiveTrackableQr(matchingQr || null);
              }}
              placeholder="e.g. 01, 02, Patio-1"
              required
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#52525B] block mb-1">
              Custom Stand Label
            </label>
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. Window Booth Stand"
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#52525B] block mb-1">
              Dining Zone
            </label>
            <input
              type="text"
              value={zoneInput}
              onChange={(e) => setZoneInput(e.target.value)}
              placeholder="e.g. Main Dining"
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#52525B] block mb-1">
              Seats
            </label>
            <input
              type="number"
              min={1}
              max={24}
              value={capacityInput}
              onChange={(e) => setCapacityInput(Number(e.target.value) || 4)}
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-2.5 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60 transition-all"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Generate QR Code</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Floor Tables + Trackable QRs */}
        <div className="space-y-4">
          {/* Table Selector Rail */}
          <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-heading uppercase tracking-wider text-[#71717A] block">
                Floor Tables ({tables.length})
              </label>
              <span className="text-[10px] text-[#A1A1AA] font-mono">
                Table {activeTableNumber}
              </span>
            </div>

            {tables.length === 0 ? (
              <p className="text-xs text-[#71717A] py-3">
                Use the Generate QR Code form above to create your first table QR stand.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
                {tables.map((tbl) => {
                  const isSelected = selectedTable?.id === tbl.id && (!activeTrackableQr || activeTrackableQr.tableNumber === tbl.number);
                  return (
                    <div
                      key={tbl.id}
                      onClick={() => {
                        setSelectedTable(tbl);
                        setTableInput(tbl.number);
                        setActiveTrackableQr(null);
                      }}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-[#F76707] bg-[#FFF4ED] shadow-xs'
                          : 'border-[#E4E4E7] hover:border-[#D4D4D8] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold font-heading text-sm text-[#18181B]">
                          Table {tbl.number}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            tbl.status === 'occupied'
                              ? 'bg-[#2563EB]'
                              : tbl.status === 'new_order'
                              ? 'bg-[#DC2626]'
                              : 'bg-[#16A34A]'
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-[#71717A] truncate">
                        {tbl.zone} • {tbl.capacity} Seats
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generated Trackable QR Codes & Scan Analytics */}
          <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold font-heading uppercase tracking-wider text-[#71717A]">
                <BarChart3 size={13} className="text-[#F76707]" />
                <span>Trackable QR Codes ({trackableQrs.length})</span>
              </div>
              <button
                type="button"
                onClick={fetchTrackableQrs}
                className="text-[10px] font-bold text-[#71717A] hover:text-[#18181B] flex items-center gap-1"
              >
                <RefreshCw size={11} className={loadingQrs ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {trackableQrs.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-center text-[11px] text-[#71717A]">
                No trackable QR codes generated yet. Mint one above to track scans per table stand.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {trackableQrs.map((qr) => {
                  const isActiveSelected = activeTrackableQr?.id === qr.id;
                  return (
                    <div
                      key={qr.id}
                      onClick={() => {
                        setActiveTrackableQr(qr);
                        setTableInput(qr.tableNumber);
                        const tbl = tables.find((t) => t.number === qr.tableNumber);
                        if (tbl) setSelectedTable(tbl);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
                        isActiveSelected
                          ? 'border-[#F76707] bg-[#FFF4ED]'
                          : 'border-[#E4E4E7] bg-[#FAFAFA] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#18181B] truncate">
                            {qr.label}
                          </div>
                          <div className="text-[10px] font-mono text-[#71717A] truncate">
                            Table {qr.tableNumber} • {qr.trackingToken}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            qr.isActive
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/20'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}
                        >
                          {qr.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#E4E4E7]/60 text-[10px]">
                        <span className="font-bold text-[#18181B]">
                          {qr.scansCount} {qr.scansCount === 1 ? 'scan' : 'scans'}
                          {qr.lastScannedAt
                            ? ` • Last ${new Date(qr.lastScannedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ''}
                        </span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleQr(qr.id)}
                            className="p-1 rounded-md bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#52525B]"
                            title={qr.isActive ? 'Pause QR' : 'Activate QR'}
                          >
                            <Power size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQr(qr.id)}
                            className="p-1 rounded-md bg-white border border-[#E4E4E7] hover:bg-red-50 text-red-600"
                            title="Delete QR"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Printable Stand & Destination URL Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Destination URL Preview Banner */}
          <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#18181B] flex items-center gap-1.5">
                <LinkIcon size={14} className="text-[#F76707] shrink-0" />
                <span>QR Destination URL Preview</span>
              </span>
              <span className="text-[10px] font-bold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#16A34A]/20 shrink-0">
                Verified Customer Route
              </span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="w-full sm:w-auto flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] font-mono text-xs text-[#18181B] truncate select-all">
                {fullDestinationUrl}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(fullDestinationUrl)}
                  className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center gap-1 shrink-0 transition-all"
                  title="Copy Destination URL"
                >
                  {copiedUrl ? <Check size={14} className="text-[#16A34A]" /> : <Copy size={14} />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={previewCustomerPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold font-heading flex items-center gap-1 shrink-0 transition-all"
                >
                  <span>Test Link</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-[#71717A] break-words">
              Scanning this QR launches the customer dining menu for{' '}
              <strong>Table {activeTableNumber}</strong> at <strong>{restaurant.name}</strong>
              {activeTrackableQr ? ` (tracking token: ${activeTrackableQr.trackingToken})` : ''}.
            </p>
          </div>

          {/* Printable Acrylic Stand Mockup */}
          <div className="bg-[#FAFAFA] rounded-3xl p-3 sm:p-6 border border-[#E4E4E7] flex flex-col items-center justify-center">
            <div className="bg-white rounded-3xl p-4 sm:p-6 border-2 border-[#18181B] shadow-2xl max-w-xs w-full text-center space-y-4 relative">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F76707]">
                  Ur.Dear.Menu TABLETOP ORDERING
                </span>
                <h3 className="text-base font-extrabold font-heading text-[#18181B]">
                  {restaurant.name}
                </h3>
                <p className="text-[11px] text-[#71717A] font-medium">
                  {selectedTable?.zone || zoneInput || 'Main Dining'}
                </p>
              </div>

              <div className="inline-block bg-[#18181B] text-white px-5 py-1.5 rounded-full text-sm font-extrabold font-heading">
                TABLE {activeTableNumber}
              </div>

              <div className="p-3 bg-[#FAFAFA] rounded-2xl border border-[#E4E4E7] inline-block shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Table ${activeTableNumber} QR`}
                    className="w-48 h-48 mx-auto object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <QrCode size={36} className="text-[#A1A1AA] animate-pulse" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-extrabold text-[#18181B] flex items-center justify-center gap-1">
                  <Smartphone size={13} className="text-[#F76707]" />
                  <span>Scan with Camera to Order</span>
                </div>
                <p className="text-[10px] text-[#71717A]">
                  No App Download • Instant Digital Menu • Live Kitchen Status
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4F4F5] text-[10px] text-[#52525B] flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold">
                  <Wifi size={12} className="text-[#2563EB]" />
                  <span>{restaurant.wifiSsid || 'Guest_WiFi'}</span>
                </span>
                <span className="font-mono font-bold text-[#18181B]">
                  Pass: {restaurant.wifiPassword || 'eatfreshbutter'}
                </span>
              </div>

              {selectedTable && (
                <div className="pt-1 text-[9px] text-[#A1A1AA] flex items-center justify-between border-t border-[#F4F4F5]">
                  <span className="truncate max-w-[140px]">
                    Token: {activeToken || selectedTable.secureToken}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRegenerateTableToken(selectedTable.id)}
                    className="text-[#F76707] hover:underline font-bold flex items-center gap-0.5 shrink-0"
                    title="Regenerate Security Token"
                  >
                    <RefreshCw size={10} /> Regenerate QR
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full max-w-xs">
              <a
                href={previewCustomerPath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-2xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center justify-center gap-2 shadow-md transition-all text-center"
              >
                <Smartphone size={16} />
                <span>Open Table {activeTableNumber} Menu</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
