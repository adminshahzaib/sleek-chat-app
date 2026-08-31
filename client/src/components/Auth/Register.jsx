import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Mail, Lock, User, MessageSquare, AlertCircle, ArrowLeft, KeyRound, Timer } from 'lucide-react';

const AVATAR_SEEDS = ['Felix', 'Aria', 'Milo', 'Zoe', 'Buster', 'Coco', 'Rusty', 'Nova'];

export default function Register({ onToggleAuth }) {
  const { sendOTP, verifyOTPAndRegister } = useAuth();
  const [step, setStep] = useState(1); // 1: Details form, 2: OTP verification
  
  // Signup Details
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedSeed, setSelectedSeed] = useState(AVATAR_SEEDS[0]);
  
  // OTP Verification details
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Step 1: Submit Details, send OTP email request
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      return setError('Please fill in all required fields');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters long');
    }
    
    setError('');
    setLoading(true);
    try {
      await sendOTP(email);
      // Success: advance to OTP input step and start 60s resend timer
      setStep(2);
      setCooldown(60);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle Resending OTP
  const handleResendOTP = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await sendOTP(email);
      setCooldown(60);
      setOtp('');
      alert('Verification code resent successfully!');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to resend verification code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit and verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      return setError('Please enter a valid 6-digit numeric verification code');
    }
    
    setError('');
    setLoading(true);
    try {
      const avatarUrl = getAvatarUrl(selectedSeed);
      await verifyOTPAndRegister(email, password, displayName, avatarUrl, otp);
      // Successful registration will auto-login through state change listener
    } catch (err) {
      console.error(err);
      setError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl border border-slate-800">
      
      {/* Header Info */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 animate-pulse">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          {step === 1 ? 'Create Account' : 'Verify Email'}
        </h1>
        <p className="text-sm text-slate-400 mt-1 text-center">
          {step === 1 
            ? 'Get started with SleekChat today' 
            : `We sent a 6-digit verification code to ${email}`}
        </p>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="mb-5 p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Details composition */}
      {step === 1 ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                placeholder="•••••••• (min 6 chars)"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Your Avatar
            </label>
            <div className="grid grid-cols-4 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {AVATAR_SEEDS.map((seed) => {
                const url = getAvatarUrl(seed);
                const isSelected = selectedSeed === seed;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setSelectedSeed(seed)}
                    className={`relative aspect-square rounded-lg overflow-hidden border p-1 bg-slate-800 transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 scale-105 ring-2 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                    disabled={loading}
                  >
                    <img src={url} alt={`Avatar ${seed}`} className="w-full h-full object-contain" />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
          >
            {loading ? 'Sending Code...' : 'Get Verification Code'}
          </button>
        </form>
      ) : (
        /* Step 2: Verification Code Form */
        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              disabled={loading}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Edit Details</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Verification Code (6-Digit OTP)
            </label>
            <div className="relative max-w-[200px] mx-auto">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-center font-mono text-xl tracking-[5px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="000000"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3">
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
            >
              {loading ? 'Verifying Account...' : 'Verify & Register'}
            </button>

            {/* Resend Link with countdown */}
            <div className="text-center mt-2 flex items-center justify-center gap-1.5 text-xs">
              {cooldown > 0 ? (
                <span className="text-slate-500 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Resend code in {cooldown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                >
                  Resend Verification OTP
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Switch to login view footer */}
      {step === 1 && (
        <div className="text-center mt-6">
          <button
            onClick={onToggleAuth}
            className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
          >
            Already have an account? Sign in
          </button>
        </div>
      )}
    </div>
  );
}
