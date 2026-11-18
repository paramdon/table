import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  ChefHat,
  Bell,
  Building2,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { PortalRole, portalAuth, StaffAuthSession } from '../../services/auth';
import { useRouter } from '../../router/Router';

interface StaffLoginGateProps {
  role: 'kitchen' | 'waiter' | 'owner' | 'manager';
  restaurantName: string;
  onAuthenticated: (session: StaffAuthSession) => void;
  revocationNotice?: boolean;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({
  role,
  restaurantName,
  onAuthenticated,
  revocationNotice = false,
}) => {
  const { navigate } = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forced password change modal state
  const [mustChangeModal, setMustChangeModal] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState('');
  const [pendingTempToken, setPendingTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');

  const roleMeta = {
    kitchen: {
      title: 'Kitchen Staff Terminal',
      subtitle: 'Bawarchikhana KDS Access Only',
      icon: ChefHat,
      color: '#DC2626',
      badge: 'Chef & Cook Station',
    },
    waiter: {
      title: 'Floor Captain Console',
      subtitle: 'Waiter & Paging Console Access Only',
      icon: Bell,
      color: '#2563EB',
      badge: 'Floor Service Staff',
    },
    owner: {
      title: 'Restaurant Owner Portal',
      subtitle: 'Executive Management & Financials',
      icon: Building2,
      color: '#18181B',
      badge: 'Proprietor & GM Only',
    },
    manager: {
      title: 'Restaurant Manager Console',
      subtitle: 'Operations & Shift Oversight',
      icon: Building2,
      color: '#D97706',
      badge: 'Shift Supervisor',
    },
  }[role];

  const Icon = roleMeta.icon;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await portalAuth.loginWithCredentials(
        username.trim(),
        password.trim(),
        '',
        customDeviceName.trim() || undefined
      );

      setLoading(false);

      if (res.requiresPasswordChange && res.staffId && res.tempToken) {
        setPendingStaffId(res.staffId);
        setPendingTempToken(res.tempToken);
        setMustChangeModal(true);
        return;
      }

      if (res.success && res.session) {
        // Enforce strict role authorization:
        // Staff role must match the gate portal, or owner can access anything
        if (role !== 'owner' && res.session.role !== role && res.session.role !== 'owner') {
          setError(
            `Access Denied: You are logged in as a "${res.session.role.toUpperCase()}", which is not authorized for the ${roleMeta.title}.`
          );
          return;
        }

        onAuthenticated(res.session);
      } else {
        setError(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Server connection error.');
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');

    if (newPassword.length < 6) {
      setChangeError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await portalAuth.changeFirstTimePassword(
      pendingStaffId,
      pendingTempToken,
      newPassword,
      customDeviceName.trim() || undefined
    );
    setLoading(false);

    if (res.success && res.session) {
      setMustChangeModal(false);
      onAuthenticated(res.session);
    } else {
      setChangeError(res.error || 'Could not update password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-sm bg-[#27272A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 relative">
        {/* Revocation Alert Banner if triggered */}
        {revocationNotice && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white font-bold">Device Access Revoked</strong>
              <span>
                Your device session was revoked by the restaurant administrator. Re-enter credentials to re-register.
              </span>
            </div>
          </div>
        )}

        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: roleMeta.color }}
          >
            <Icon size={28} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFDBCC]">
              {roleMeta.badge}
            </span>
            <h1 className="text-xl font-extrabold font-heading text-white mt-1.5">
              {roleMeta.title}
            </h1>
            <p className="text-xs text-[#A1A1AA]">{restaurantName}</p>
          </div>
        </div>

        {/* Security Note */}
        <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[11px] text-[#D4D4D8] flex items-center gap-2">
          <Lock size={15} className="text-[#F76707] shrink-0" />
          <span>Server-authorized device verification & RBAC isolation active.</span>
        </div>

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
              Staff Username or Email:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your assigned username or email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs focus:outline-hidden focus:border-[#F76707]"
              />
              <User size={15} className="absolute left-3 top-3 text-[#71717A]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-[#A1A1AA]">Password:</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-[#A1A1AA] hover:text-white flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs focus:outline-hidden focus:border-[#F76707]"
              />
              <KeyRound size={15} className="absolute left-3 top-3 text-[#71717A]" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#A1A1AA] block mb-1">
              Device Label (Optional):
            </label>
            <div className="relative">
              <input
                type="text"
                value={customDeviceName}
                onChange={(e) => setCustomDeviceName(e.target.value)}
                placeholder="e.g. Front Counter iPad / Kitchen Display 2"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#18181B] border border-white/10 text-white text-[11px] text-white/80 focus:outline-hidden focus:border-[#F76707]"
              />
              <Smartphone size={13} className="absolute left-3 top-2.5 text-[#71717A]" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-400">
                <AlertTriangle size={14} />
                <span>Authentication Notice</span>
              </div>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] disabled:opacity-50 text-white font-extrabold font-heading text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Verifying Device & Credentials...</span>
            ) : (
              <>
                <span>Sign In & Register Device</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Global Staff Login Link */}
        <div className="pt-2 text-center text-[11px] text-[#71717A] flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/staff-login')}
            className="text-[#FFDBCC] hover:underline font-bold"
          >
            Staff Universal Login &rarr;
          </button>
        </div>
      </div>

      {/* ================= MODAL: FORCE PASSWORD CHANGE ON FIRST LOGIN ================= */}
      {mustChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#27272A] w-full max-w-sm rounded-3xl p-6 border border-white/20 shadow-2xl space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-[#F76707]/20 border border-[#F76707]/40 text-[#F76707] mx-auto flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-base font-extrabold text-white font-heading">
                Initialize Permanent Password
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Your account was created with a temporary password. Choose a secure permanent password to register this device.
              </p>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
                  New Password (min 6 characters):
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs"
                />
              </div>

              {changeError && (
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-300 text-xs">
                  {changeError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md"
              >
                {loading ? 'Saving Password & Registering Device...' : 'Save & Enter Portal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
