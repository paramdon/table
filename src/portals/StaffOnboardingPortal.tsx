import React, { useState, useEffect } from 'react';
import { useRouter } from '../router/Router';
import { portalAuth } from '../services/auth';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChefHat,
  Bell,
  Building2,
  KeyRound,
  Smartphone,
  Sparkles,
} from 'lucide-react';

export const StaffOnboardingPortal: React.FC = () => {
  const { queryParams, navigate } = useRouter();
  const token = queryParams.get('token') || queryParams.get('invite') || '';

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token in the onboarding URL.');
      setLoading(false);
      return;
    }

    fetch(`/api/auth/invitation/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (data.success && data.invitation) {
          setInvitation(data.invitation);
        } else {
          setError(data.error || 'Invitation is invalid, expired, or already used.');
        }
      })
      .catch((err) => {
        setLoading(false);
        setError('Failed to contact restaurant authentication server.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await portalAuth.onboardWithInvitation(
      token,
      password,
      deviceName.trim() || undefined
    );
    setSubmitting(false);

    if (res.success && res.session) {
      setSuccess(true);
      setTimeout(() => {
        if (res.session?.role === 'kitchen') {
          navigate('/kitchen');
        } else if (res.session?.role === 'waiter') {
          navigate('/waiter');
        } else {
          navigate('/owner');
        }
      }, 1500);
    } else {
      setSubmitError(res.error || 'Could not complete onboarding.');
    }
  };

  const roleMeta: Record<string, { title: string; color: string; icon: any }> = {
    kitchen: { title: 'Kitchen Staff / Cook', color: '#DC2626', icon: ChefHat },
    waiter: { title: 'Floor Waiter & Captain', color: '#2563EB', icon: Bell },
    manager: { title: 'Shift Operations Manager', color: '#D97706', icon: Building2 },
    owner: { title: 'Restaurant Owner', color: '#18181B', icon: Building2 },
  };

  const meta = invitation ? roleMeta[invitation.role] || roleMeta.waiter : roleMeta.waiter;
  const RoleIcon = meta.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F76707] flex items-center justify-center mx-auto animate-pulse">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-[#A1A1AA]">
            Verifying secure restaurant onboarding invitation...
          </p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#27272A] border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-extrabold font-heading text-white">
              Invitation Link Invalid or Expired
            </h1>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">{error}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs text-[#71717A] text-left space-y-1">
            <div>• Each invitation link is single-use and expires after 48 hours.</div>
            <div>• Ask your restaurant manager or owner to issue a fresh invite link.</div>
          </div>
          <button
            onClick={() => navigate('/staff-login')}
            className="w-full py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md transition-all"
          >
            Go to Staff Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col items-center justify-center p-4 font-sans overflow-x-hidden">
      <div className="w-full max-w-md bg-[#27272A] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Onboarding Header */}
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: meta.color }}
          >
            <RoleIcon size={28} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFDBCC]">
              Welcome to the Team
            </span>
            <h1 className="text-xl font-extrabold font-heading text-white mt-1">
              Staff Device Onboarding
            </h1>
            <p className="text-xs text-[#A1A1AA]">
              Set up your employee credentials & register your trusted workstation
            </p>
          </div>
        </div>

        {/* Assigned Details Card */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#A1A1AA]">Employee Name:</span>
            <span className="font-bold text-white text-sm">{invitation.staffName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A1A1AA]">Assigned Username:</span>
            <span className="font-mono text-[#F76707] font-bold">{invitation.username}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#A1A1AA]">Assigned Role:</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-bold text-[11px] uppercase">
              {meta.title}
            </span>
          </div>
          <div className="pt-1.5 border-t border-white/5 text-[10px] text-[#71717A] flex items-center gap-1">
            <ShieldCheck size={12} className="text-[#16A34A]" />
            <span>Role pre-configured by Owner. Cannot be modified by employee.</span>
          </div>
        </div>

        {success ? (
          <div className="p-5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-center space-y-2 animate-in zoom-in-95">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Setup Complete!</h3>
            <p className="text-xs text-emerald-200">
              Trusted device registered. Launching your assigned portal now...
            </p>
          </div>
        ) : (
          /* Password & Device Setup Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
                Create Permanent Password:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs focus:outline-hidden focus:border-[#F76707]"
                />
                <Lock size={15} className="absolute left-3 top-3 text-[#71717A]" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#A1A1AA] block mb-1">
                Confirm Permanent Password:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#18181B] border border-white/20 text-white text-xs focus:outline-hidden focus:border-[#F76707]"
                />
                <KeyRound size={15} className="absolute left-3 top-3 text-[#71717A]" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[#A1A1AA] block mb-1">
                Device Nickname (Optional):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Personal iPhone / Kitchen Station 1"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#18181B] border border-white/10 text-white text-[11px] focus:outline-hidden focus:border-[#F76707]"
                />
                <Smartphone size={13} className="absolute left-3 top-2.5 text-[#71717A]" />
              </div>
              <span className="text-[10px] text-[#71717A] mt-1 block">
                This device will be registered as your trusted workstation.
              </span>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-extrabold font-heading shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <span>Registering Device & Session...</span>
              ) : (
                <>
                  <span>Complete Onboarding & Enter Portal</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-2 text-center text-[10px] text-[#71717A]">
          d.cc Restaurant OS • Multi-tenant isolation & server-verified device trust
        </div>
      </div>
    </div>
  );
};
