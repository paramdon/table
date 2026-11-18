import React, { useState, useEffect } from 'react';
import {
  Users,
  Smartphone,
  Shield,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Edit2,
  KeyRound,
  Link as LinkIcon,
  Copy,
  Check,
  X,
  AlertTriangle,
  Clock,
  Laptop,
  Tablet,
  CheckCircle2,
  ExternalLink,
  Power,
  RotateCcw,
  FileText,
  CalendarClock,
  MapPin,
  Coffee,
  Play,
  Square,
  Lock,
} from 'lucide-react';
import {
  StaffProfile,
  RegisteredDevice,
  SecurityAuditLog,
  RestaurantTable,
  StaffScheduleAssignment,
  WaiterBreakWindow,
  WaiterShiftStatus,
} from '../../types/dcc';
import { useRealtimeSync } from '../../context/RealtimeSyncContext';
import {
  useEntitlements,
  parseFeatureLockedPayload,
} from '../../hooks/useEntitlements';
import { UpgradePromptModal, LockedFeatureBanner } from './UpgradePromptModal';

interface StaffManagementViewProps {
  restaurantId?: string;
  ownerToken?: string;
  tables?: RestaurantTable[];
  initialSubTab?: 'directory' | 'scheduling' | 'devices' | 'audit';
  onOpenBillingPlans?: (recommendedPlanId?: string) => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  restaurantId = 'demo-restaurant',
  ownerToken,
  tables = [],
  initialSubTab = 'directory',
  onOpenBillingPlans,
}) => {
  const {
    getStaffSchedules,
    upsertStaffSchedule,
    deleteStaffSchedule,
    setWaiterDutyStatus,
    toggleBreakWindowStatus,
  } = useRealtimeSync();

  const {
    plan: currentPlan,
    hasFeature,
    lockedPrompt,
    setLockedPrompt,
    triggerLockedFeature,
  } = useEntitlements(restaurantId, ownerToken);

  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'scheduling' | 'devices' | 'audit'>(
    initialSubTab
  );
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [deviceList, setDeviceList] = useState<RegisteredDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Scheduling Builder State
  const [schedStaffId, setSchedStaffId] = useState<string>('');
  const [schedCustomName, setSchedCustomName] = useState<string>('');
  const [schedRole, setSchedRole] = useState<'waiter' | 'manager'>('waiter');
  const [schedZones, setSchedZones] = useState<string[]>([]);
  const [schedCustomZone, setSchedCustomZone] = useState<string>('');
  const [schedShiftStart, setSchedShiftStart] = useState<string>('11:00');
  const [schedShiftEnd, setSchedShiftEnd] = useState<string>('23:00');
  const [schedDutyStatus, setSchedDutyStatus] = useState<WaiterShiftStatus>('on_duty');
  const [schedBreaks, setSchedBreaks] = useState<WaiterBreakWindow[]>([]);
  const [schedNotes, setSchedNotes] = useState<string>('');
  const [newBreakLabel, setNewBreakLabel] = useState<string>('Tea Break');
  const [newBreakStart, setNewBreakStart] = useState<string>('16:00');
  const [newBreakEnd, setNewBreakEnd] = useState<string>('16:20');
  const [editingScheduleStaffId, setEditingScheduleStaffId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [generatedTempPass, setGeneratedTempPass] = useState<string | null>(null);

  // Add Form state
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<'kitchen' | 'waiter' | 'manager'>('waiter');
  const [formOnboardingMethod, setFormOnboardingMethod] = useState<'invite' | 'temporary_password'>('invite');
  const [formTempPassword, setFormTempPassword] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>(['tables:view', 'waiter:requests']);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit Form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'kitchen' | 'waiter' | 'manager'>('waiter');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  // Fetch Data from Backend
  const canManageDevices = hasFeature('device_management');
  const canInviteLinks = hasFeature('staff_onboarding');

  useEffect(() => {
    if (!canInviteLinks && formOnboardingMethod === 'invite') {
      setFormOnboardingMethod('temporary_password');
    }
  }, [canInviteLinks, formOnboardingMethod]);

  const loadData = async () => {
    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [staffRes, devRes, logRes] = await Promise.all([
        fetch('/api/staff', { headers }).then((r) => r.json()),
        fetch('/api/devices', { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/security-logs', { headers }).then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (staffRes.success && staffRes.staff) {
        setStaffList(staffRes.staff);
      }
      if (devRes.success && devRes.devices) {
        setDeviceList(devRes.devices);
      } else {
        setDeviceList([]);
      }
      if (logRes.success && logRes.logs) {
        setAuditLogs(logRes.logs);
      }
    } catch (e) {
      console.warn('Could not refresh staff data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [ownerToken]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Create Staff Profile
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim() || !formUsername.trim()) {
      setFormError('Staff name and username are required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName.trim(),
          username: formUsername.trim().toLowerCase(),
          phone: formPhone.trim(),
          role: formRole,
          permissions: formPermissions,
          onboardingMethod: formOnboardingMethod,
          tempPassword: formTempPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      setFormSubmitting(false);

      if (!res.ok || !data.success) {
        const locked = parseFeatureLockedPayload(data);
        if (locked) {
          setLockedPrompt(locked);
          return;
        }
        setFormError(data.error || 'Failed to create staff profile.');
        return;
      }

      if (data.staff.invitationLink) {
        const fullUrl = `${window.location.origin}${data.staff.invitationLink}`;
        setGeneratedInviteLink(fullUrl);
      } else if (data.staff.tempPassword) {
        setGeneratedTempPass(data.staff.tempPassword);
      }

      showNotice(`Created staff profile for ${data.staff.name}`);
      await loadData();

      // Reset form fields
      setFormName('');
      setFormUsername('');
      setFormPhone('');
      setFormTempPassword('');
    } catch (err: any) {
      setFormSubmitting(false);
      setFormError(err.message || 'Server communication error.');
    }
  };

  // 2. Open Edit Staff Modal
  const handleOpenEdit = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setEditName(staff.name);
    setEditPhone(staff.phone || '');
    setEditRole(staff.role as any);
    setEditStatus(staff.status);
    setEditPermissions(staff.permissions || []);
    setIsEditStaffModalOpen(true);
  };

  // 3. Save Edit Staff
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/staff/${selectedStaff.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          role: editRole,
          status: editStatus,
          permissions: editPermissions,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsEditStaffModalOpen(false);
        showNotice(`Updated staff profile for ${editName}`);
        await loadData();
      } else {
        alert(data.error || 'Failed to update staff profile');
      }
    } catch (e) {
      alert('Network request failed');
    }
  };

  // 4. Toggle Disable / Enable Staff
  const handleToggleStaffStatus = async (staff: StaffProfile) => {
    const nextStatus = staff.status === 'active' ? 'disabled' : 'active';
    const confirmMsg =
      nextStatus === 'disabled'
        ? `Disable account for ${staff.name}? This will immediately revoke all active device sessions!`
        : `Reactivate account for ${staff.name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(
          nextStatus === 'disabled'
            ? `Disabled ${staff.name}. All active sessions terminated immediately.`
            : `Reactivated ${staff.name}.`
        );
        await loadData();
      }
    } catch (e) {
      alert('Failed to change status');
    }
  };

  // 5. Delete Staff Profile
  const handleDeleteStaff = async (staff: StaffProfile) => {
    if (staff.role === 'owner') {
      alert('The primary restaurant owner cannot be deleted.');
      return;
    }

    if (!window.confirm(`Permanently remove staff account "${staff.name}" (${staff.username})?`)) {
      return;
    }

    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Staff profile "${staff.name}" deleted.`);
        await loadData();
      }
    } catch (e) {
      alert('Failed to delete staff member');
    }
  };

  // 6. Reset Password / Generate New Invite
  const handleResetPassword = async (staff: StaffProfile, method: 'invite' | 'temporary_password') => {
    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/staff/${staff.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          tempPassword: method === 'temporary_password' ? `UDM-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.invitationLink) {
          const full = `${window.location.origin}${data.invitationLink}`;
          setGeneratedInviteLink(full);
        } else if (data.tempPassword) {
          setGeneratedTempPass(data.tempPassword);
        }
        setSelectedStaff(staff);
        setIsResetPasswordModalOpen(true);
        showNotice(`Password reset generated for ${staff.name}. Existing sessions revoked.`);
        await loadData();
      } else {
        const locked = parseFeatureLockedPayload(data);
        if (locked) {
          setLockedPrompt(locked);
        } else {
          setActionNotice(data.error || 'Failed to reset password.');
        }
      }
    } catch (e) {
      setActionNotice('Failed to reset password');
    }
  };

  // 7. Revoke Specific Device
  const handleRevokeDevice = async (deviceId: string, staffName: string) => {
    if (!window.confirm(`Revoke this device for ${staffName}? The employee will lose access immediately.`)) {
      return;
    }

    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/devices/${deviceId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Device revoked. ${staffName} will be redirected to the login screen.`);
        await loadData();
      } else {
        const locked = parseFeatureLockedPayload(data);
        if (locked) setLockedPrompt(locked);
      }
    } catch (e) {
      setActionNotice('Failed to revoke device');
    }
  };

  // 8. Revoke All Devices for Staff Member
  const handleRevokeAllForStaff = async (staff: StaffProfile) => {
    if (!window.confirm(`Revoke ALL active devices for ${staff.name}?`)) return;

    try {
      const token = ownerToken || JSON.parse(localStorage.getItem('urdearmenu_trusted_staff_session') || '{}')?.sessionToken;
      const res = await fetch(`/api/devices/staff/${staff.id}/revoke-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotice(`Revoked all devices for ${staff.name}.`);
        await loadData();
      } else {
        const locked = parseFeatureLockedPayload(data);
        if (locked) setLockedPrompt(locked);
      }
    } catch (e) {
      setActionNotice('Failed to revoke all devices');
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
      );
    }
    return true;
  });

  const activeStaffCount = staffList.filter((s) => s.status === 'active').length;
  const activeDeviceCount = deviceList.filter((d) => d.status === 'active').length;

  const staffSchedules = getStaffSchedules(restaurantId);
  const floorZones = React.useMemo(() => {
    const zoneSet = new Set<string>();
    tables.forEach((t) => {
      if (t.zone && t.zone.trim()) zoneSet.add(t.zone.trim());
    });
    staffSchedules.forEach((s) => {
      s.assignedZones.forEach((z) => {
        if (z.trim()) zoneSet.add(z.trim());
      });
    });
    schedZones.forEach((z) => {
      if (z.trim()) zoneSet.add(z.trim());
    });
    if (zoneSet.size === 0) {
      ['Main Dining', 'Courtyard Verandah', 'Patio Deck'].forEach((z) => zoneSet.add(z));
    }
    return Array.from(zoneSet);
  }, [tables, staffSchedules, schedZones]);

  const waiterCandidates = React.useMemo(() => {
    const active = staffList.filter(
      (s) => s.status === 'active' && (s.role === 'waiter' || s.role === 'manager')
    );
    return active.sort((a, b) => {
      if (a.role === 'waiter' && b.role !== 'waiter') return -1;
      if (b.role === 'waiter' && a.role !== 'waiter') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [staffList]);

  const handleSelectScheduleCandidate = (staffIdVal: string) => {
    setSchedStaffId(staffIdVal);
    if (!staffIdVal || staffIdVal === '__custom__') {
      setEditingScheduleStaffId(null);
      return;
    }
    const existing = staffSchedules.find((s) => s.staffId === staffIdVal);
    if (existing) {
      setEditingScheduleStaffId(existing.staffId);
      setSchedCustomName(existing.staffName);
      setSchedRole(existing.role === 'manager' ? 'manager' : 'waiter');
      setSchedZones(existing.assignedZones);
      setSchedShiftStart(existing.shiftStart);
      setSchedShiftEnd(existing.shiftEnd);
      setSchedDutyStatus(existing.dutyStatus);
      setSchedBreaks(existing.breaks || []);
      setSchedNotes(existing.notes || '');
    } else {
      const staffObj = staffList.find((s) => s.id === staffIdVal);
      setEditingScheduleStaffId(null);
      setSchedCustomName(staffObj?.name || '');
      setSchedRole(staffObj?.role === 'manager' ? 'manager' : 'waiter');
      setSchedZones(floorZones.length > 0 ? [floorZones[0]] : []);
      setSchedShiftStart('11:00');
      setSchedShiftEnd('23:00');
      setSchedDutyStatus('on_duty');
      setSchedBreaks([]);
      setSchedNotes('');
    }
  };

  const handleToggleZoneSelection = (zoneName: string) => {
    setSchedZones((prev) =>
      prev.includes(zoneName) ? prev.filter((z) => z !== zoneName) : [...prev, zoneName]
    );
  };

  const handleAddCustomZone = () => {
    const clean = schedCustomZone.trim();
    if (!clean) return;
    if (!schedZones.includes(clean)) {
      setSchedZones((prev) => [...prev, clean]);
    }
    setSchedCustomZone('');
  };

  const handleAddBreakWindow = (preset?: { label: string; startTime: string; endTime: string }) => {
    const label = (preset?.label || newBreakLabel).trim() || 'Rest Break';
    const startTime = preset?.startTime || newBreakStart || '16:00';
    const endTime = preset?.endTime || newBreakEnd || '16:20';
    const newBreak: WaiterBreakWindow = {
      id: `brk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      startTime,
      endTime,
      status: 'scheduled',
    };
    setSchedBreaks((prev) => [...prev, newBreak]);
  };

  const handleRemoveBreakDraft = (breakId: string) => {
    setSchedBreaks((prev) => prev.filter((b) => b.id !== breakId));
  };

  const handleEditScheduleRow = (sched: StaffScheduleAssignment) => {
    setEditingScheduleStaffId(sched.staffId);
    const inDirectory = staffList.some((s) => s.id === sched.staffId);
    setSchedStaffId(inDirectory ? sched.staffId : '__custom__');
    setSchedCustomName(sched.staffName);
    setSchedRole(sched.role === 'manager' ? 'manager' : 'waiter');
    setSchedZones(sched.assignedZones);
    setSchedShiftStart(sched.shiftStart);
    setSchedShiftEnd(sched.shiftEnd);
    setSchedDutyStatus(sched.dutyStatus);
    setSchedBreaks(sched.breaks || []);
    setSchedNotes(sched.notes || '');
  };

  const handleResetScheduleForm = () => {
    setEditingScheduleStaffId(null);
    setSchedStaffId('');
    setSchedCustomName('');
    setSchedRole('waiter');
    setSchedZones([]);
    setSchedShiftStart('11:00');
    setSchedShiftEnd('23:00');
    setSchedDutyStatus('on_duty');
    setSchedBreaks([]);
    setSchedNotes('');
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedStaff =
      schedStaffId && schedStaffId !== '__custom__'
        ? staffList.find((s) => s.id === schedStaffId)
        : undefined;
    const resolvedName = (matchedStaff?.name || schedCustomName).trim();
    if (!resolvedName) return;

    const resolvedStaffId =
      editingScheduleStaffId ||
      matchedStaff?.id ||
      `waiter-${resolvedName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

    upsertStaffSchedule(restaurantId, {
      staffId: resolvedStaffId,
      staffName: resolvedName,
      username: matchedStaff?.username,
      role: matchedStaff?.role || schedRole,
      assignedZones: schedZones,
      shiftStart: schedShiftStart,
      shiftEnd: schedShiftEnd,
      dutyStatus: schedDutyStatus,
      breaks: schedBreaks,
      notes: schedNotes,
    });

    showNotice(
      `Saved floor zone & break schedule for ${resolvedName} (${
        schedZones.length > 0 ? schedZones.join(', ') : 'No zones'
      })`
    );
    handleResetScheduleForm();
  };

  return (
    <div className="space-y-4">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold font-heading text-[#18181B] flex flex-wrap items-center gap-2">
            <span>Staff Onboarding & Device Management</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Server-Enforced RBAC
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Zero-Trust Device Trust
            </span>
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Administer employee credentials, issue single-use invitation links, and manage trusted hardware workstations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[#18181B] transition-all shadow-2xs"
            title="Refresh Data"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              setGeneratedInviteLink(null);
              setGeneratedTempPass(null);
              setIsAddStaffModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus size={15} />
            <span>+ Add Staff Profile</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-[#E4E4E7] gap-4 text-xs font-bold font-heading overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`pb-2.5 flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'directory'
              ? 'border-[#F76707] text-[#F76707]'
              : 'border-transparent text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <Users size={16} />
          <span>Staff Directory ({staffList.length})</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#F4F4F5] text-[#52525B]">
            {activeStaffCount} Active
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('scheduling')}
          className={`pb-2.5 flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'scheduling'
              ? 'border-[#F76707] text-[#F76707]'
              : 'border-transparent text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <CalendarClock size={16} />
          <span>Zone &amp; Break Scheduling</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#FFDBCC] text-[#A14000]">
            {staffSchedules.length} Assigned
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('devices')}
          className={`pb-2.5 flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'devices'
              ? 'border-[#F76707] text-[#F76707]'
              : 'border-transparent text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <Smartphone size={16} />
          <span>Registered Devices ({deviceList.length})</span>
          {!canManageDevices ? (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#FFF4ED] text-[#F76707] border border-[#FFDBCC] flex items-center gap-0.5">
              <Lock size={9} />
              <span>Essential</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
              {activeDeviceCount} Online
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-2.5 flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'audit'
              ? 'border-[#F76707] text-[#F76707]'
              : 'border-transparent text-[#71717A] hover:text-[#18181B]'
          }`}
        >
          <FileText size={16} />
          <span>Security Audit Trail</span>
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeSubTab === 'directory' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, username, or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E4E7] text-xs placeholder:text-[#A1A1AA] focus:outline-hidden"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-[#71717A]" />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-xs font-medium"
              >
                <option value="all">All Roles</option>
                <option value="waiter">Waiters</option>
                <option value="kitchen">Kitchen Staff</option>
                <option value="manager">Managers</option>
                <option value="owner">Owner</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-xs font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>
          </div>

          {/* Staff Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredStaff.map((staff) => {
              const staffDevices = deviceList.filter((d) => d.staffId === staff.id);
              const activeDevCount = staffDevices.filter((d) => d.status === 'active').length;
              const isOwner = staff.role === 'owner';
              const isDisabled = staff.status === 'disabled';

              return (
                <div
                  key={staff.id}
                  className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-xs ${
                    isDisabled ? 'border-red-200 bg-red-50/20 opacity-80' : 'border-[#E4E4E7]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold font-heading text-[#18181B]">
                            {staff.name}
                          </h4>
                          {isOwner && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#18181B] text-white">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-[#F76707]">@{staff.username}</div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            staff.role === 'kitchen'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : staff.role === 'waiter'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {staff.role}
                        </span>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            isDisabled
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isDisabled ? 'Disabled' : 'Active Account'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#71717A] space-y-1 pt-1 border-t border-[#F4F4F5]">
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span className="font-medium text-[#18181B]">{staff.phone || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Registered Devices:</span>
                        <span className="font-bold text-[#18181B] flex items-center gap-1">
                          <Smartphone size={12} className={activeDevCount > 0 ? 'text-[#16A34A]' : 'text-[#71717A]'} />
                          <span>{activeDevCount} active</span>
                          {staffDevices.length > activeDevCount && (
                            <span className="text-[10px] text-red-600 font-normal">
                              ({staffDevices.length - activeDevCount} revoked)
                            </span>
                          )}
                        </span>
                      </div>
                      {staff.mustChangePassword && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-medium">
                          ⚠️ Temporary password active. First login forces reset.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Staff Actions Bar */}
                  <div className="pt-2 border-t border-[#F4F4F5] flex flex-wrap items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(staff)}
                        className="p-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[#18181B]"
                        title="Edit Details & Role"
                      >
                        <Edit2 size={13} />
                      </button>

                      {!isOwner && (
                        <>
                          <button
                            onClick={() => {
                              if (!canInviteLinks) {
                                triggerLockedFeature('staff_onboarding');
                                return;
                              }
                              handleResetPassword(staff, 'invite');
                            }}
                            className="p-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[#2563EB] flex items-center gap-0.5"
                            title={
                              canInviteLinks
                                ? 'Generate Invitation Link'
                                : 'Invitation Links require Essential Plan'
                            }
                          >
                            <LinkIcon size={13} />
                            {!canInviteLinks && <Lock size={10} className="text-[#F76707]" />}
                          </button>

                          <button
                            onClick={() => handleResetPassword(staff, 'temporary_password')}
                            className="p-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-amber-600"
                            title="Reset with Temporary Password"
                          >
                            <KeyRound size={13} />
                          </button>
                        </>
                      )}
                    </div>

                    {!isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStaffStatus(staff)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isDisabled
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                          }`}
                          title={isDisabled ? 'Reactivate staff profile' : 'Disable staff and revoke all device sessions'}
                        >
                          {isDisabled ? 'Reactivate' : 'Disable'}
                        </button>

                        <button
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200"
                          title="Delete staff account"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: FLOOR ZONE & BREAK SCHEDULING */}
      {activeSubTab === 'scheduling' && (
        <div className="space-y-4">
          {/* Live Floor Zone Coverage Overview */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold font-heading text-[#18181B] flex items-center gap-2">
                  <MapPin size={16} className="text-[#F76707]" />
                  <span>Live Floor Zone Coverage</span>
                </h3>
                <p className="text-xs text-[#71717A]">
                  Real-time assignment across dining zones — synced instantaneously to WaiterPortal consoles
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F4F4F5] text-[#52525B]">
                {staffSchedules.length} {staffSchedules.length === 1 ? 'Waiter' : 'Waiters'} Scheduled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {floorZones.map((zone) => {
                const zoneTables = tables.filter((t) => (t.zone || '').trim() === zone);
                const assignedWaiters = staffSchedules.filter((s) =>
                  s.assignedZones.includes(zone)
                );
                const onDutyCount = assignedWaiters.filter((w) => w.dutyStatus === 'on_duty').length;
                const onBreakCount = assignedWaiters.filter((w) => w.dutyStatus === 'on_break').length;

                return (
                  <div
                    key={zone}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                      assignedWaiters.length === 0
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-[#FAFAFA] border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold font-heading text-[#18181B] truncate">
                          {zone}
                        </div>
                        <div className="text-[10px] text-[#71717A]">
                          {zoneTables.length} {zoneTables.length === 1 ? 'table' : 'tables'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          assignedWaiters.length === 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {assignedWaiters.length === 0
                          ? 'Uncovered'
                          : `${onDutyCount} Duty${onBreakCount > 0 ? ` • ${onBreakCount} Brk` : ''}`}
                      </span>
                    </div>

                    {assignedWaiters.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedWaiters.map((w) => (
                          <span
                            key={w.staffId}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                              w.dutyStatus === 'on_break'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : w.dutyStatus === 'off_duty'
                                ? 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]'
                                : 'bg-white text-[#18181B] border-[#E4E4E7]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                w.dutyStatus === 'on_duty'
                                  ? 'bg-[#16A34A]'
                                  : w.dutyStatus === 'on_break'
                                  ? 'bg-[#F59E0B]'
                                  : 'bg-[#A1A1AA]'
                              }`}
                            />
                            <span className="truncate max-w-[90px]">{w.staffName}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-700 font-medium">
                        No waiter assigned to this zone yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Form: Assign Waiter to Zones & Manage Break Windows */}
            <form
              onSubmit={handleSaveSchedule}
              className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                    <CalendarClock size={16} className="text-[#F76707]" />
                    <span>
                      {editingScheduleStaffId ? 'Edit Waiter Shift & Breaks' : 'Assign Waiter Zone & Breaks'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Select a floor waiter, assign zone(s), and configure shift & break windows
                  </p>
                </div>
                {editingScheduleStaffId && (
                  <button
                    type="button"
                    onClick={handleResetScheduleForm}
                    className="text-[11px] font-bold text-[#71717A] hover:text-[#18181B] px-2 py-1 rounded-lg bg-[#F4F4F5]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Staff Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#18181B] block">
                  Select Floor Staff
                </label>
                <select
                  value={schedStaffId}
                  onChange={(e) => handleSelectScheduleCandidate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-semibold text-[#18181B] focus:outline-none focus:border-[#F76707]"
                >
                  <option value="">-- Choose staff member or enter manually --</option>
                  {waiterCandidates.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role.toUpperCase()} • @{staff.username})
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Waiter Name</option>
                </select>

                {(schedStaffId === '__custom__' || !schedStaffId) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <input
                      type="text"
                      value={schedCustomName}
                      onChange={(e) => setSchedCustomName(e.target.value)}
                      placeholder="Waiter name (e.g. Arjun Verma)"
                      className="sm:col-span-2 px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs focus:outline-none focus:border-[#F76707]"
                    />
                    <select
                      value={schedRole}
                      onChange={(e) => setSchedRole(e.target.value as 'waiter' | 'manager')}
                      className="px-2.5 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-semibold"
                    >
                      <option value="waiter">Waiter</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Floor Zone Multi-Select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#18181B]">
                    Assigned Floor Zones ({schedZones.length})
                  </label>
                  <span className="text-[10px] text-[#71717A]">Tap to toggle zones</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {floorZones.map((zone) => {
                    const selected = schedZones.includes(zone);
                    return (
                      <button
                        key={zone}
                        type="button"
                        onClick={() => handleToggleZoneSelection(zone)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                          selected
                            ? 'bg-[#18181B] text-white border-[#18181B] shadow-2xs'
                            : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:border-[#F76707]'
                        }`}
                      >
                        <MapPin size={11} className={selected ? 'text-[#F76707]' : 'text-[#71717A]'} />
                        <span>{zone}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={schedCustomZone}
                    onChange={(e) => setSchedCustomZone(e.target.value)}
                    placeholder="Add custom zone (e.g. Rooftop Lounge)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs focus:outline-none focus:border-[#F76707]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomZone}
                    className="px-3 py-1.5 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] text-xs font-bold"
                  >
                    + Zone
                  </button>
                </div>
              </div>

              {/* Shift Hours & Duty Status */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[#71717A] block mb-1">
                    Shift Start
                  </label>
                  <input
                    type="time"
                    value={schedShiftStart}
                    onChange={(e) => setSchedShiftStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-mono font-bold text-[#18181B]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#71717A] block mb-1">
                    Shift End
                  </label>
                  <input
                    type="time"
                    value={schedShiftEnd}
                    onChange={(e) => setSchedShiftEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-mono font-bold text-[#18181B]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#71717A] block mb-1">
                    Duty Status
                  </label>
                  <select
                    value={schedDutyStatus}
                    onChange={(e) => setSchedDutyStatus(e.target.value as WaiterShiftStatus)}
                    className="w-full px-2 py-1.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B]"
                  >
                    <option value="on_duty">On Duty</option>
                    <option value="on_break">On Break</option>
                    <option value="off_duty">Off Duty</option>
                  </select>
                </div>
              </div>

              {/* Break Schedule Builder */}
              <div className="p-3 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] font-extrabold text-[#18181B] flex items-center gap-1.5">
                    <Coffee size={13} className="text-[#F76707]" />
                    <span>Break Schedule ({schedBreaks.length})</span>
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleAddBreakWindow({ label: 'Tea Break', startTime: '16:00', endTime: '16:20' })
                      }
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-[#E4E4E7] hover:border-[#F76707] text-[#18181B]"
                    >
                      + Tea 16:00
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddBreakWindow({ label: 'Meal Break', startTime: '18:30', endTime: '19:00' })
                      }
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-[#E4E4E7] hover:border-[#F76707] text-[#18181B]"
                    >
                      + Meal 18:30
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                  <input
                    type="text"
                    value={newBreakLabel}
                    onChange={(e) => setNewBreakLabel(e.target.value)}
                    placeholder="Break label"
                    className="sm:col-span-5 px-2.5 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-xs"
                  />
                  <input
                    type="time"
                    value={newBreakStart}
                    onChange={(e) => setNewBreakStart(e.target.value)}
                    className="sm:col-span-3 px-2 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-[11px] font-mono"
                  />
                  <input
                    type="time"
                    value={newBreakEnd}
                    onChange={(e) => setNewBreakEnd(e.target.value)}
                    className="sm:col-span-3 px-2 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-[11px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddBreakWindow()}
                    className="sm:col-span-1 py-1.5 px-2 rounded-xl bg-[#18181B] text-white text-xs font-bold flex items-center justify-center"
                    title="Add Break Window"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {schedBreaks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {schedBreaks.map((brk) => (
                      <div
                        key={brk.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-[#E4E4E7] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Coffee size={12} className="text-[#F76707] shrink-0" />
                          <span className="font-bold text-[#18181B] truncate">{brk.label}</span>
                          <span className="text-[11px] font-mono text-[#71717A] shrink-0">
                            {brk.startTime}–{brk.endTime}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakDraft(brk.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                  Shift Handover / Station Notes (Optional)
                </label>
                <input
                  type="text"
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder="e.g. Cover VIP Table 01 & coordinate bar pass"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs focus:outline-none focus:border-[#F76707]"
                />
              </div>

              <button
                type="submit"
                disabled={!(schedStaffId && schedStaffId !== '__custom__') && !schedCustomName.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] disabled:opacity-50 text-white text-xs font-bold font-heading shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>
                  {editingScheduleStaffId ? 'Update Schedule Assignment' : 'Save & Sync to WaiterPortal'}
                </span>
              </button>
            </form>

            {/* Right Column: Active Waiter Floor & Break Roster */}
            <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold font-heading text-[#18181B]">
                    Active Floor &amp; Break Roster ({staffSchedules.length})
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Tap any break pill to cycle Scheduled → On Break → Completed
                  </p>
                </div>
              </div>

              {staffSchedules.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#FAFAFA] border border-dashed border-[#E4E4E7] text-center space-y-2">
                  <CalendarClock size={26} className="text-[#A1A1AA] mx-auto" />
                  <div className="text-xs font-bold text-[#18181B]">
                    No Waiter Schedules Assigned Yet
                  </div>
                  <p className="text-[11px] text-[#71717A] max-w-sm mx-auto">
                    Use the assignment panel on the left to assign waiters to floor zones and configure break windows. Changes sync live to the WaiterPortal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffSchedules.map((sched) => (
                    <div
                      key={sched.staffId}
                      className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold font-heading text-[#18181B]">
                              {sched.staffName}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-[#E4E4E7] text-[#52525B]">
                              {sched.role}
                            </span>
                            <span className="text-[11px] font-mono text-[#71717A] flex items-center gap-1">
                              <Clock size={11} />
                              {sched.shiftStart} – {sched.shiftEnd}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {sched.assignedZones.length > 0 ? (
                              sched.assignedZones.map((zone) => (
                                <span
                                  key={zone}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#18181B] text-white flex items-center gap-1"
                                >
                                  <MapPin size={10} className="text-[#F76707]" />
                                  <span>{zone}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                No zones assigned
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            value={sched.dutyStatus}
                            onChange={(e) =>
                              setWaiterDutyStatus(
                                restaurantId,
                                sched.staffId,
                                e.target.value as WaiterShiftStatus
                              )
                            }
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
                              sched.dutyStatus === 'on_duty'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : sched.dutyStatus === 'on_break'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                            }`}
                          >
                            <option value="on_duty">On Duty</option>
                            <option value="on_break">On Break</option>
                            <option value="off_duty">Off Duty</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleEditScheduleRow(sched)}
                            className="p-1.5 rounded-lg bg-white border border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#18181B]"
                            title="Edit Schedule"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              deleteStaffSchedule(restaurantId, sched.staffId);
                              showNotice(`Removed schedule for ${sched.staffName}`);
                            }}
                            className="p-1.5 rounded-lg bg-white border border-[#E4E4E7] hover:bg-red-50 text-red-500"
                            title="Delete Schedule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Break Windows Strip */}
                      <div className="pt-2 border-t border-[#E4E4E7]/70 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mr-1">
                          Breaks:
                        </span>
                        {sched.breaks.length === 0 ? (
                          <span className="text-[11px] text-[#71717A]">No breaks scheduled</span>
                        ) : (
                          sched.breaks.map((brk) => (
                            <button
                              key={brk.id}
                              type="button"
                              onClick={() =>
                                toggleBreakWindowStatus(restaurantId, sched.staffId, brk.id)
                              }
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all ${
                                brk.status === 'active'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                  : brk.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                                  : 'bg-white text-[#18181B] border-[#E4E4E7] hover:border-[#F76707]'
                              }`}
                              title="Click to cycle break status"
                            >
                              {brk.status === 'active' ? (
                                <Square size={10} className="fill-amber-700 text-amber-700" />
                              ) : brk.status === 'completed' ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Play size={10} className="text-[#F76707]" />
                              )}
                              <span>{brk.label}</span>
                              <span className="font-mono text-[10px] opacity-80">
                                {brk.startTime}–{brk.endTime}
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      {sched.notes && (
                        <div className="text-[11px] text-[#52525B] bg-white px-2.5 py-1.5 rounded-xl border border-[#E4E4E7]">
                          <strong>Station Note:</strong> {sched.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTERED DEVICES */}
      {activeSubTab === 'devices' && !canManageDevices && (
        <LockedFeatureBanner
          title="Staff Device Registration & Remote Logout"
          description="Monitor every tablet and kitchen display logged into your workspace, enforce one-time hardware binding, and remotely revoke lost or unauthorized staff sessions."
          requiredPlanName="Essential"
          requiredPlanPriceInr={1999}
          currentPlanName={currentPlan?.name || 'Flex'}
          onUpgradeClick={() => triggerLockedFeature('device_management')}
        />
      )}

      {activeSubTab === 'devices' && canManageDevices && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-[#18181B] flex items-center gap-2">
                <span>Hardware Workstations & Mobile Tablets</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {activeDeviceCount} Active Workstations
                </span>
              </h3>
              <p className="text-xs text-[#71717A]">
                Owner can remotely revoke any device session. Revocation terminates API access instantly and ejects the user.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E4E4E7] text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Device Label</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Last Active</th>
                    <th className="p-3.5">Registered</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F5]">
                  {deviceList.map((dev) => {
                    const isRevoked = dev.status === 'revoked';
                    const Icon =
                      dev.deviceType === 'tablet' ? Tablet : dev.deviceType === 'mobile' ? Smartphone : Laptop;

                    return (
                      <tr key={dev.id} className={isRevoked ? 'bg-red-50/20 text-[#71717A]' : 'hover:bg-[#FAFAFA]'}>
                        <td className="p-3.5 font-bold text-[#18181B]">
                          <div>{dev.staffName}</div>
                          <div className="text-[10px] font-mono text-[#71717A]">{dev.staffId}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-semibold text-[#18181B]">
                            <Icon size={14} className={isRevoked ? 'text-red-400' : 'text-[#F76707]'} />
                            <span>{dev.deviceName}</span>
                          </div>
                          <div className="text-[10px] text-[#A1A1AA] truncate max-w-[180px]">
                            {dev.userAgent}
                          </div>
                        </td>
                        <td className="p-3.5 uppercase font-mono text-[10px] text-[#52525B]">
                          {dev.deviceType}
                        </td>
                        <td className="p-3.5 font-bold uppercase text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded-full ${
                              dev.role === 'kitchen'
                                ? 'bg-red-50 text-red-700'
                                : dev.role === 'waiter'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-zinc-100 text-zinc-800'
                            }`}
                          >
                            {dev.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-[#52525B]">
                          {new Date(dev.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3.5 text-[11px] text-[#71717A]">
                          {new Date(dev.registeredAt).toLocaleDateString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isRevoked
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isRevoked ? 'Revoked' : 'Active Session'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {!isRevoked ? (
                            <button
                              onClick={() => handleRevokeDevice(dev.id, dev.staffName)}
                              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold transition-all"
                            >
                              Revoke Access
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#A1A1AA] italic">Terminated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY AUDIT LOG */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-xs p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-heading text-[#18181B] flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#16A34A]" />
                <span>Security & Authorization Event Log</span>
              </h3>
              <p className="text-xs text-[#71717A]">
                Immutable server audit log recording device registrations, revocations, and role updates
              </p>
            </div>
            <button
              onClick={() => loadData()}
              className="text-xs text-[#2563EB] hover:underline font-bold flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="divide-y divide-[#F4F4F5] max-h-[500px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        log.action.includes('REVOKE')
                          ? 'bg-red-100 text-red-700'
                          : log.action.includes('CREATED')
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <strong className="text-[#18181B]">{log.targetStaffName}</strong>
                    <span className="text-[#A1A1AA]">• by {log.performedBy}</span>
                  </div>
                  <p className="text-[#52525B] text-[11px]">{log.details}</p>
                </div>
                <span className="text-[10px] text-[#A1A1AA] whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD STAFF PROFILE ================= */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-[#F4F4F5] flex items-center justify-between bg-[#18181B] text-white">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#F76707]" />
                <h3 className="text-base font-extrabold font-heading">Add Staff Profile & Onboard</h3>
              </div>
              <button onClick={() => setIsAddStaffModalOpen(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-white">
                <X size={18} />
              </button>
            </div>

            {/* Generated Link / Pass display after creation */}
            {generatedInviteLink || generatedTempPass ? (
              <div className="p-6 space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base font-bold text-[#18181B]">Staff Profile Created!</h4>

                {generatedInviteLink && (
                  <div className="space-y-2 text-left bg-[#FAFAFA] p-4 rounded-2xl border border-[#E4E4E7]">
                    <span className="text-xs font-bold text-[#18181B] block">
                      Single-Use Onboarding Link (Valid 48 Hours):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInviteLink}
                        className="flex-1 px-3 py-2 bg-white rounded-xl border border-[#E4E4E7] font-mono text-xs select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInviteLink);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="px-3 py-2 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading flex items-center gap-1"
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Share this link with the employee via WhatsApp or SMS. Opening it lets them set their password and registers their phone.
                    </p>
                  </div>
                )}

                {generatedTempPass && (
                  <div className="space-y-2 text-left bg-[#FAFAFA] p-4 rounded-2xl border border-[#E4E4E7]">
                    <span className="text-xs font-bold text-[#18181B] block">Temporary Password for First Login:</span>
                    <div className="p-3 bg-white border border-[#E4E4E7] rounded-xl font-mono text-sm font-bold text-[#F76707] text-center select-all">
                      {generatedTempPass}
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Give this temporary password to the employee. On first login, they will be forced to choose a permanent password and register their device.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateStaff} className="p-5 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#18181B] block mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Sunita Patel"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#18181B] block mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="e.g. waiter_sunita"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#18181B] block mb-1">Role Assignment</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white font-semibold"
                    >
                      <option value="waiter">Waiter (Floor Service Captain)</option>
                      <option value="kitchen">Kitchen Staff (Cook / Chef)</option>
                      <option value="manager">Manager (Shift Supervisor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#18181B] block mb-1">Mobile Phone (Optional)</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98000 00000"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                    />
                  </div>
                </div>

                {/* Onboarding Method Selection */}
                <div className="space-y-2 p-3 bg-[#FAFAFA] rounded-2xl border border-[#E4E4E7]">
                  <label className="font-bold text-[#18181B] block">Onboarding Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      onClick={(e) => {
                        if (!canInviteLinks) {
                          e.preventDefault();
                          triggerLockedFeature('staff_onboarding');
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                        !canInviteLinks
                          ? 'border-[#E4E4E7] bg-zinc-50 opacity-85'
                          : formOnboardingMethod === 'invite'
                          ? 'border-[#F76707] bg-[#FFF4ED]'
                          : 'border-[#E4E4E7] bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-bold text-[#18181B]">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="onboardingMethod"
                            checked={formOnboardingMethod === 'invite'}
                            disabled={!canInviteLinks}
                            onChange={() => setFormOnboardingMethod('invite')}
                            className="accent-[#F76707]"
                          />
                          <span>Method A: Invitation Link</span>
                        </div>
                        {!canInviteLinks && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#F76707] border border-[#FFDBCC] flex items-center gap-0.5">
                            <Lock size={9} /> Essential
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#71717A]">
                        One-time expiring link. Employee sets password on their phone.
                      </span>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                        formOnboardingMethod === 'temporary_password'
                          ? 'border-[#F76707] bg-[#FFF4ED]'
                          : 'border-[#E4E4E7] bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[#18181B]">
                        <input
                          type="radio"
                          name="onboardingMethod"
                          checked={formOnboardingMethod === 'temporary_password'}
                          onChange={() => setFormOnboardingMethod('temporary_password')}
                          className="accent-[#F76707]"
                        />
                        <span>Method B: Temp Password</span>
                      </div>
                      <span className="text-[10px] text-[#71717A]">
                        Provide temp password. Forces reset on first login.
                      </span>
                    </label>
                  </div>

                  {formOnboardingMethod === 'temporary_password' && (
                    <div className="pt-2">
                      <label className="font-bold text-[#18181B] block mb-1">
                        Temporary Password (leave blank for auto-generated):
                      </label>
                      <input
                        type="text"
                        value={formTempPassword}
                        onChange={(e) => setFormTempPassword(e.target.value)}
                        placeholder="e.g. UDM-982314"
                        className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
                    {formError}
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStaffModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] text-[#71717A] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-bold font-heading shadow-md"
                  >
                    {formSubmitting ? 'Creating Profile...' : 'Save & Generate Onboarding'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT STAFF PROFILE ================= */}
      {isEditStaffModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#F4F4F5] flex items-center justify-between bg-[#18181B] text-white">
              <h3 className="text-base font-extrabold font-heading">
                Edit Staff: {selectedStaff.name}
              </h3>
              <button onClick={() => setIsEditStaffModalOpen(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#18181B] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                />
              </div>

              <div>
                <label className="font-bold text-[#18181B] block mb-1">Mobile Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7]"
                />
              </div>

              {selectedStaff.role !== 'owner' && (
                <div>
                  <label className="font-bold text-[#18181B] block mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white font-semibold"
                  >
                    <option value="waiter">Floor Waiter</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="manager">Operations Manager</option>
                  </select>
                </div>
              )}

              {selectedStaff.role !== 'owner' && (
                <div>
                  <label className="font-bold text-[#18181B] block mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white font-semibold"
                  >
                    <option value="active">Active (Can log in & maintain sessions)</option>
                    <option value="disabled">Disabled (Revokes all sessions immediately)</option>
                  </select>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditStaffModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] text-[#71717A] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-bold font-heading shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD DISPLAY ================= */}
      {isResetPasswordModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E4E4E7] p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center">
                <KeyRound size={24} />
              </div>
              <h3 className="text-base font-bold text-[#18181B]">
                Password Reset for {selectedStaff.name}
              </h3>
              <p className="text-xs text-[#71717A]">
                Existing active device sessions for this employee were automatically revoked.
              </p>
            </div>

            {generatedInviteLink && (
              <div className="space-y-2 text-left bg-[#FAFAFA] p-3.5 rounded-2xl border border-[#E4E4E7]">
                <span className="text-xs font-bold text-[#18181B] block">New Invitation Link:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-[#E4E4E7] font-mono text-xs select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading flex items-center gap-1"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {generatedTempPass && (
              <div className="space-y-2 text-left bg-[#FAFAFA] p-3.5 rounded-2xl border border-[#E4E4E7]">
                <span className="text-xs font-bold text-[#18181B] block">New Temporary Password:</span>
                <div className="p-3 bg-white border border-[#E4E4E7] rounded-xl font-mono text-sm font-bold text-[#F76707] text-center select-all">
                  {generatedTempPass}
                </div>
              </div>
            )}

            <button
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#18181B] text-white text-xs font-bold font-heading"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <UpgradePromptModal
        lockedError={lockedPrompt}
        onClose={() => setLockedPrompt(null)}
        onViewPlans={(planId) => {
          setLockedPrompt(null);
          onOpenBillingPlans?.(planId);
        }}
      />
    </div>
  );
};
