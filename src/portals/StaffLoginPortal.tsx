import React, { useState } from 'react';
import { useRouter } from '../router/Router';
import { portalAuth, StaffAuthSession } from '../services/auth';
import {
  Lock,
  ShieldCheck,
  User,
  KeyRound,
  ArrowRight,
  ChefHat,
  Bell,
  Building2,
  Smartphone,
  Eye,
  EyeOff,
  AlertTriangle,
  Link as LinkIcon,
} from 'lucide-react';

export const StaffLoginPortal: React.FC = () => {
  const { navigate } = useRouter();

  const [username, setUsername] = useState('waiter_rajesh');
  const [password, setPassword] = useState('waiter123');
  const [showPassword, setShowPassword] = useState(false);
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // First time password change modal
  const [mustChangeModal, setMustChangeModal] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState('');
  const [pendingTempToken, setPendingTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');

  // Invite link quick enter
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await portalAuth.loginWithCredentials(
        username.trim(),
        password.trim(),
        'demo-restaurant',
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
        redirectToAssignedPortal(res.session);
      } else {
        setError(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Connection to authentication server failed.');
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
      redirectToAssignedPortal(res.session);
    } else {
      setChangeError(res.error || 'Could not update password.');
    }
  };

  const redirectToAssignedPortal = (session: StaffAuthSession) => {
    if (session.role === 'kitchen') {
      navigate('/kitchen');
    } else if (session.role === 'waiter') {
      navigate('/waiter');
    } else {
      navigate('/owner');
    }
  };

  const handleQuickSelect = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  const handleGoToInvite = () => {
    if (!inviteTokenInput.trim()) return;
    let cleanToken = inviteTokenInput.trim();
    if (cleanToken.includes('token=')) {
      cleanToken = cleanToken.split('token=')[1].split('&')[0];
    }
    navigate(`/onboard?token=${encodeURIComponent(cleanToken)}`);
  };

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col items-center justify-center p-4 font-sans overflow-x-hidden">
      <div className="w-full max-w-md bg-[#27272A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#F76707] flex items-center justify-center text-white font-extrabold text-lg mx-auto shadow-lg">
            UDM
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFDBCC]">
              d.cc Restaurant OS
            </span>
            <h1 className="text-xl font-extrabold font-heading text-white mt-1">
              Staff & Terminal Login
            </h1>
            <p className="text-xs text-[#A1A1AA]">
              Secure one-time device setup & role-based workstation access
            </p>
          </div>
        </div>

        {/* Quick Role Fillers */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block text-center">
            Quick Station Credentials
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickSelect('waiter_rajesh', 'waiter123')}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === 'waiter_rajesh'
                  ? 'border-[#2563EB] bg-[#2563EB]/20 text-white'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 text-[#A1A1AA]'
              }`}
            >
              <Bell size={16} className="mx-auto mb-1 text-[#2563EB]" />
              <div className="text-xs font-bold">Waiter</div>
              <div className="text-[9px] opacity-70">Rajesh</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSelect('chef_gurpreet', 'chef123')}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === 'chef_gurpreet'
                  ? 'border-[#DC2626] bg-[#DC2626]/20 text-white'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 text-[#A1A1AA]'
              }`}
            >
              <ChefHat size={16} className="mx-auto mb-1 text-[#DC2626]" />
              <div className="text-xs font-bold">Kitchen</div>
              <div className="text-[9px] opacity-70">Gurpreet</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSelect('owner', 'owner9999')}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === 'owner'
                  ? 'border-[#F76707] bg-[#F76707]/20 text-white'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 text-[#A1A1AA]'
              }`}
            >
              <Building2 size={16} className="mx-auto mb-1 text-[#F76707]" />
              <div className="text-xs font-bold">Owner</div>
              <div className="text-[9px] opacity-70">Vikram</div>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
              Username or ID:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. waiter_rajesh)"
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
              Device Name / Workstation (Optional):
            </label>
            <div className="relative">
              <input
                type="text"
                value={customDeviceName}
                onChange={(e) => setCustomDeviceName(e.target.value)}
                placeholder="e.g. Floor Captain Handheld #1"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#18181B] border border-white/10 text-white text-[11px] focus:outline-hidden focus:border-[#F76707]"
              />
              <Smartphone size={13} className="absolute left-3 top-2.5 text-[#71717A]" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-400">
                <AlertTriangle size={14} />
                <span>Authentication Failed</span>
              </div>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-extrabold font-heading shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Authenticating Device & Profile...</span>
            ) : (
              <>
                <span>Sign In to Terminal</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Invitation Link Input Accordion */}
        <div className="pt-2 border-t border-white/10 text-center">
          {!showInviteInput ? (
            <button
              type="button"
              onClick={() => setShowInviteInput(true)}
              className="text-xs text-[#A1A1AA] hover:text-white flex items-center justify-center gap-1.5 mx-auto transition-all"
            >
              <LinkIcon size={12} className="text-[#F76707]" />
              <span>Have an Invitation Link from Owner? Click here</span>
            </button>
          ) : (
            <div className="space-y-2 text-left bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span>Enter Invitation Token:</span>
                <button
                  onClick={() => setShowInviteInput(false)}
                  className="text-[10px] text-[#A1A1AA] hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteTokenInput}
                  onChange={(e) => setInviteTokenInput(e.target.value)}
                  placeholder="Paste token or /onboard?token=..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleGoToInvite}
                  className="px-3 py-2 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading"
                >
                  Verify
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-[#71717A]">
          Ur.Dear.Menu • Server-Enforced RBAC & Remote Revocation Protection
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
