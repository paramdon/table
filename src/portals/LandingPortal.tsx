import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../router/Router';
import { portalAuth } from '../services/auth';
import { restaurantDb } from '../services/db';
import { PricingSection } from '../components/dcc/PricingSection';
import {
  PLAN_DEFINITIONS,
  BillingCycle,
  PlanDefinition,
} from '../config/subscriptionPlans';
import { SubscriptionPlanConfig } from '../types/dcc';
import {
  UtensilsCrossed,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  Mail,
  Building2,
  Phone,
  Check,
  QrCode,
  ChefHat,
  Bell,
} from 'lucide-react';

interface LandingPortalProps {
  initialFocus?: 'pricing';
}

export const LandingPortal: React.FC<LandingPortalProps> = ({ initialFocus }) => {
  const { navigate } = useRouter();
  const pricingRef = useRef<HTMLElement | null>(null);
  const authBoxRef = useRef<HTMLDivElement | null>(null);

  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Registration wizard steps: 1 = Owner details, 2 = Email verification, 3 = Restaurant details, 4 = Plan, 5 = Launch
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4>(1);
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('849201');
  const [enteredCode, setEnteredCode] = useState('849201');
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Restaurant details
  const [regRestName, setRegRestName] = useState('');
  const [regCuisine, setRegCuisine] = useState('North Indian & Tandoor Grill');
  const [regCity, setRegCity] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlan, setRegPlan] = useState<'flex' | 'essential' | 'professional' | 'enterprise'>('flex');
  const [regCycle, setRegCycle] = useState<BillingCycle>('monthly');
  const [livePlans, setLivePlans] = useState<SubscriptionPlanConfig[]>([]);

  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  useEffect(() => {
    fetch('/api/billing/plans')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plans)) {
          setLivePlans(data.plans);
        }
      })
      .catch(() => {
        // fallback to PLAN_DEFINITIONS inside PricingSection
      });
  }, []);

  useEffect(() => {
    if (initialFocus === 'pricing' && pricingRef.current) {
      setTimeout(() => {
        pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [initialFocus]);

  // Handle Owner Login
  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Login failed. Please check your credentials.');
        setLoginLoading(false);
        return;
      }

      // Store authenticated session
      portalAuth.setSession(data.session);

      // Hydrate local restaurant context
      if (data.restaurant) {
        restaurantDb.setActiveRestaurant(data.restaurant);
      }

      // Navigate to Owner Portal
      navigate(`/owner?restaurant=${data.session.restaurantId}`);
    } catch (err: any) {
      setLoginError('Connection error. Please try again.');
      setLoginLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMessage(data.message || 'Password reset link sent to your email.');
    } catch (err) {
      setForgotMessage('Could not send reset link. Please verify your email.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle Owner Registration Final Submission
  const handleCompleteRegistration = async () => {
    setRegLoading(true);
    setRegError('');

    try {
      const res = await fetch('/api/auth/register-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName,
          email: regEmail,
          password: regPassword,
          restaurantName: regRestName,
          cuisine: regCuisine,
          city: regCity,
          address: regAddress,
          phone: regPhone,
          currency: 'INR',
          plan: regPlan,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRegError(data.error || 'Failed to create restaurant workspace.');
        setRegLoading(false);
        return;
      }

      // Store authentic owner session
      portalAuth.setSession(data.session);

      // Update local storage database with registered restaurant
      if (data.restaurant) {
        restaurantDb.setActiveRestaurant(data.restaurant);
      }

      // Route directly to owner portal with clean workspace
      navigate(`/owner?restaurant=${data.session.restaurantId}`);
    } catch (err: any) {
      setRegError('Failed to connect to registration server. Please try again.');
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F12] text-[#F4F4F5] flex flex-col font-sans overflow-x-hidden selection:bg-[#F76707] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#18181B]/80 backdrop-blur-md border-b border-white/5 px-3 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#F76707] to-[#DC2626] flex items-center justify-center shadow-lg shadow-[#F76707]/20 shrink-0">
            <UtensilsCrossed size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-base sm:text-lg tracking-tight text-white truncate">
                Ur.Dear.Menu
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F76707]/10 text-[#F76707] border border-[#F76707]/20 uppercase tracking-wider shrink-0">
                SaaS Platform
              </span>
            </div>
            <p className="text-[10px] text-[#A1A1AA] hidden sm:block truncate">
              Modern Multi-Tenant Restaurant Operating System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors hidden md:block px-3 py-1.5"
          >
            Pricing
          </button>
          <a
            href="#features"
            className="text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors hidden md:block px-3 py-1.5"
          >
            Features
          </a>
          <button
            onClick={() => {
              setAuthMode('login');
              authBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl text-white hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              setRegStep(1);
              authBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="text-xs font-bold px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#F76707] to-[#EA580C] text-white shadow-md shadow-[#F76707]/20 hover:brightness-110 transition-all flex items-center gap-1 whitespace-nowrap"
          >
            <span>Start Free</span>
            <ArrowRight size={13} className="hidden xs:inline" />
          </button>
        </div>
      </header>

      {/* Main SaaS Hero & Auth Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 space-y-14 sm:space-y-16">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: SaaS Value Proposition */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] sm:text-xs font-medium text-[#F76707] max-w-full">
              <Sparkles size={14} className="shrink-0" />
              <span className="truncate sm:whitespace-normal">Start Free on Flex (₹0/mo) • 4 Flexible SaaS Tiers • Isolated Workspaces</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-heading tracking-tight text-white leading-[1.1]">
              The Operating System for{' '}
              <span className="bg-gradient-to-r from-[#F76707] via-[#FF8A3D] to-[#E11D48] bg-clip-text text-transparent">
                High-Velocity
              </span>{' '}
              Dine-In Restaurants.
            </h1>

            <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed max-w-2xl">
              Equip every table with an intelligent contactless QR menu. Streamline kitchen order execution with automated prep timers, enable anti-spam waiter calling, and track real dine-in sales with multi-tenant privacy.
            </p>

            {/* Platform Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#18181B] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#F76707]/10 text-[#F76707] flex items-center justify-center mb-2">
                  <QrCode size={18} />
                </div>
                <h4 className="text-xs font-bold text-white font-heading">Smart Table QR</h4>
                <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                  Mobile web dining with live order tracking and instant Chef's Daily Specials.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#18181B] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center mb-2">
                  <ChefHat size={18} />
                </div>
                <h4 className="text-xs font-bold text-white font-heading">Live Kitchen KDS</h4>
                <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                  Real-time ticket progression with WebSocket audio chimes delivered directly to tables.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#18181B] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-2">
                  <Bell size={18} />
                </div>
                <h4 className="text-xs font-bold text-white font-heading">Anti-Spam Waiter Pager</h4>
                <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug">
                  Protected table service buzzers with 60-second cooldown timer prevention.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-[#71717A]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Instant QR code generation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Isolated tenant database</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive SaaS Authentication Portal */}
          <div ref={authBoxRef} className="lg:col-span-5 min-w-0">
            <div className="bg-[#18181B] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
              {/* Top Mode Toggle */}
              <div className="flex rounded-xl bg-white/5 p-1 mb-6 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError('');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                    authMode === 'login'
                      ? 'bg-[#F76707] text-white shadow'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Owner Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setRegError('');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold font-heading transition-all ${
                    authMode === 'register'
                      ? 'bg-[#F76707] text-white shadow'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Create Restaurant
                </button>
              </div>

              {/* ================= MODE: LOGIN ================= */}
              {authMode === 'login' && (
                <form onSubmit={handleOwnerLogin} className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold font-heading text-white">
                      Welcome to your Workspace
                    </h3>
                    <p className="text-xs text-[#A1A1AA] mt-1">
                      Enter your restaurant owner email and password to access financials, floor map and menus.
                    </p>
                  </div>

                  {loginError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                        Owner Email Address
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]"
                        />
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="owner@yourrestaurant.com"
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-[#A1A1AA]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(loginEmail);
                            setIsForgotModalOpen(true);
                          }}
                          className="text-[11px] font-medium text-[#F76707] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]"
                        />
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading hover:bg-[#EA580C] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F76707]/20 disabled:opacity-50"
                  >
                    {loginLoading ? (
                      <span>Signing in...</span>
                    ) : (
                      <>
                        <span>Sign In to Restaurant Dashboard</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-[#71717A]">
                      Don't have a restaurant registered yet?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthMode('register')}
                        className="font-bold text-[#F76707] hover:underline"
                      >
                        Register Restaurant
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* ================= MODE: REGISTRATION WIZARD ================= */}
              {authMode === 'register' && (
                <div className="space-y-4">
                  {/* Step Tracker */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#F76707] text-white text-[10px] font-bold flex items-center justify-center">
                        {regStep}
                      </span>
                      <span className="text-xs font-bold font-heading text-white">
                        {regStep === 1 && 'Step 1: Owner Profile'}
                        {regStep === 2 && 'Step 2: Email Verification'}
                        {regStep === 3 && 'Step 3: Restaurant Workspace'}
                        {regStep === 4 && 'Step 4: Subscription Tier'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#A1A1AA] font-mono">
                      {regStep}/4 Steps
                    </span>
                  </div>

                  {regError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      {regError}
                    </div>
                  )}

                  {/* Step 1: Owner Details */}
                  {regStep === 1 && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="e.g. Vikram Malhotra"
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                          Work Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="owner@myrestaurant.com"
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                          Create Strong Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!regFullName.trim() || !regEmail.trim() || !regPassword) {
                            setRegError('Please fill in your name, email, and password.');
                            return;
                          }
                          setRegError('');
                          setRegStep(2);
                        }}
                        className="w-full mt-2 py-3 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading hover:bg-[#EA580C] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F76707]/20"
                      >
                        <span>Continue to Verification</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {/* Step 2: Email Verification */}
                  {regStep === 2 && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                        <Mail className="mx-auto text-[#F76707] mb-2" size={24} />
                        <h4 className="text-xs font-bold text-white">Verify Your Email Address</h4>
                        <p className="text-[11px] text-[#A1A1AA] mt-1">
                          We sent a 6-digit confirmation code to{' '}
                          <span className="text-white font-mono">{regEmail}</span>
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1 text-center">
                          6-Digit Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={enteredCode}
                          onChange={(e) => setEnteredCode(e.target.value)}
                          className="w-full bg-[#27272A] border border-white/10 rounded-xl py-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-[#F76707]"
                        />
                        <p className="text-[10px] text-center text-[#71717A] mt-1">
                          Quick code auto-filled for instant verification: {verificationCode}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRegStep(1)}
                          className="py-2.5 px-4 rounded-xl bg-white/5 text-xs font-bold text-[#A1A1AA]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (enteredCode.trim().length < 6) {
                              setRegError('Please enter the 6-digit verification code.');
                              return;
                            }
                            setIsEmailVerified(true);
                            setRegError('');
                            setRegStep(3);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading hover:bg-[#EA580C] flex items-center justify-center gap-2"
                        >
                          <span>Confirm & Next</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Restaurant Details */}
                  {regStep === 3 && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                          Restaurant Name *
                        </label>
                        <div className="relative">
                          <Building2
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]"
                          />
                          <input
                            type="text"
                            required
                            value={regRestName}
                            onChange={(e) => setRegRestName(e.target.value)}
                            placeholder="e.g. Royal Spice Kitchen"
                            className="w-full bg-[#27272A] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                            Cuisine / Tagline
                          </label>
                          <input
                            type="text"
                            value={regCuisine}
                            onChange={(e) => setRegCuisine(e.target.value)}
                            placeholder="e.g. Tandoor & Grill"
                            className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                            City / Location
                          </label>
                          <input
                            type="text"
                            value={regCity}
                            onChange={(e) => setRegCity(e.target.value)}
                            placeholder="e.g. Mumbai"
                            className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                          Contact Phone Number
                        </label>
                        <div className="relative">
                          <Phone
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]"
                          />
                          <input
                            type="tel"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="+91 98000 12345"
                            className="w-full bg-[#27272A] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setRegStep(2)}
                          className="py-2.5 px-4 rounded-xl bg-white/5 text-xs font-bold text-[#A1A1AA]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!regRestName.trim()) {
                              setRegError('Please provide your restaurant name.');
                              return;
                            }
                            setRegError('');
                            setRegStep(4);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-[#F76707] text-white text-xs font-bold font-heading hover:bg-[#EA580C] flex items-center justify-center gap-2"
                        >
                          <span>Choose Plan</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Plan Selection & Launch */}
                  {regStep === 4 && (
                    <div className="space-y-3">
                      <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                        {PLAN_DEFINITIONS.map((p) => {
                          const isSelected = regPlan === p.slug;
                          return (
                            <div
                              key={p.id}
                              onClick={() => setRegPlan(p.slug)}
                              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#F76707]/10 border-[#F76707]'
                                  : 'bg-white/5 border-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">{p.name}</span>
                                  {p.recommended && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F76707] text-white">
                                      Recommended
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-400">
                                    {p.commissionPercent}% comm.
                                  </span>
                                </div>
                                <span
                                  className={`text-xs font-bold ${
                                    p.priceInr === 0 ? 'text-emerald-400' : 'text-[#F76707]'
                                  }`}
                                >
                                  ₹{p.priceInr.toLocaleString('en-IN')} / mo
                                </span>
                              </div>
                              <p className="text-[10px] text-[#A1A1AA] mt-0.5 leading-snug">
                                {p.targetCustomer}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {regPlan !== 'flex' && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200 leading-relaxed">
                          Workspaces always initialize on <strong>Flex (₹0/mo)</strong> first. Paid{' '}
                          <strong className="capitalize">{regPlan}</strong> features activate only after verified payment checkout in Owner Billing &amp; Subscription.
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setRegStep(3)}
                          className="py-3 px-4 rounded-xl bg-white/5 text-xs font-bold text-[#A1A1AA]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={regLoading}
                          onClick={handleCompleteRegistration}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F76707] to-[#DC2626] text-white text-xs font-bold font-heading hover:brightness-110 flex items-center justify-center gap-2 shadow-lg shadow-[#F76707]/20 disabled:opacity-50"
                        >
                          {regLoading ? (
                            <span>Provisioning Workspace...</span>
                          ) : (
                            <>
                              <span>Complete & Launch Dashboard</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-center border-t border-white/5">
                    <p className="text-xs text-[#71717A]">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className="font-bold text-[#F76707] hover:underline"
                      >
                        Sign in here
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= SECTION: HOW UR.DEAR.MENU WORKS ================= */}
        <section id="features" className="space-y-8 pt-8 border-t border-white/5">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black font-heading text-white">
              End-to-End Digital Restaurant Architecture
            </h2>
            <p className="text-xs sm:text-sm text-[#A1A1AA]">
              Four dedicated portals communicating through a unified real-time WebSocket backend with zero simulated data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#F76707]/10 text-[#F76707] flex items-center justify-center">
                <QrCode size={20} />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">1. Customer QR Portal</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Customers scan a table QR (e.g. <code className="text-[#F76707]">/customer?table=01</code>). They browse dishes, customize spice levels, order specials, and alert floor staff.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center">
                <ChefHat size={20} />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">2. Kitchen Display KDS</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Tickets appear automatically with preparation timers. Marking dishes Ready fires direct WebSocket alerts to the table customer screen with audio chimes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                <Bell size={20} />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">3. Waiter Console</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Waitstaff receive instant table alerts (Water, Bill, Captain) protected by spam cooldown timers, plus ready-food pickup notifications.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">4. Owner OS</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Complete menu CRUD, QR generation, floor map setup, staff invitation management, and Recharts daily order velocity & revenue trends.
              </p>
            </div>
          </div>
        </section>

        {/* ================= SECTION: PRICING ================= */}
        <section id="pricing" ref={pricingRef} className="space-y-8 pt-8 border-t border-white/5">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F76707]/15 border border-[#F76707]/30 text-[10px] font-extrabold uppercase tracking-wider text-[#F76707]">
              Transparent d.cc SaaS Pricing
            </span>
            <h2 className="text-2xl sm:text-4xl font-black font-heading text-white">
              Start Free on Flex, Scale to 0% Commission
            </h2>
            <p className="text-xs sm:text-sm text-[#A1A1AA]">
              Every restaurant starts on Flex (₹0/month) with core QR ordering, KDS, and Waiter Console unlocked. Lower your QR order commission and unlock enterprise hospitality tools as you grow.
            </p>
          </div>

          <PricingSection
            variant="dark"
            plans={livePlans}
            billingCycle={regCycle}
            onBillingCycleChange={setRegCycle}
            showComparisonTable={true}
            onSelectPlan={(selected: PlanDefinition) => {
              setRegPlan(selected.slug);
              setAuthMode('register');
              authBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </section>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-white/10 rounded-3xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white font-heading">Reset Owner Password</h3>
            <p className="text-xs text-[#A1A1AA]">
              Enter the email address registered with your restaurant workspace.
            </p>

            {forgotMessage && (
              <div className="p-3 rounded-xl bg-[#F76707]/10 border border-[#F76707]/30 text-xs text-[#F76707]">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="owner@yourrestaurant.com"
                className="w-full bg-[#27272A] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#F76707]"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-white/5 text-xs font-bold text-[#A1A1AA]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] text-white text-xs font-bold hover:bg-[#EA580C] disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer with Discreet Staff & Super Admin Portals */}
      <footer className="mt-auto border-t border-white/5 bg-[#121215] py-8 px-4 sm:px-8 text-xs text-[#71717A]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#F76707] flex items-center justify-center text-white text-[10px] font-black">
              UDM
            </div>
            <span className="font-heading font-bold text-white">Ur.Dear.Menu</span>
            <span>• © {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button
              onClick={() => navigate('/staff-login')}
              className="text-[#A1A1AA] hover:text-[#F76707] transition-colors flex items-center gap-1"
            >
              <ChefHat size={13} />
              <span>Staff & Kitchen Terminal Login</span>
            </button>
            <span className="text-white/10">•</span>
            <button
              onClick={() => navigate('/admin')}
              className="text-[#A1A1AA] hover:text-[#F76707] transition-colors flex items-center gap-1"
            >
              <ShieldCheck size={13} />
              <span>Platform Super Admin</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
