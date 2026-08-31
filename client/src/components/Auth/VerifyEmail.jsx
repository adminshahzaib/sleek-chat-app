import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { MailCheck, RefreshCw, ArrowRight, LogOut, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function VerifyEmail() {
  const { currentUser, resendVerificationEmail, checkEmailVerified, logout } = useAuth();
  const [cooldown, setCooldown] = useState(60); // 60-second initial cooldown
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('We sent a verification link to your email address.');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle countdown timer for cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setSuccess('');
    setResending(true);

    try {
      await resendVerificationEmail();
      setSuccess('A new verification email has been sent! Please check your inbox.');
      setCooldown(60);
    } catch (err) {
      console.error('[VerifyEmail] Resend error:', err);
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few moments before trying again.');
      } else {
        setError(err.message.replace('Firebase:', '').trim() || 'Failed to resend verification email.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (checking) return;
    setError('');
    setSuccess('');
    setChecking(true);

    try {
      const isVerified = await checkEmailVerified();
      if (!isVerified) {
        setError('Your email is not verified yet. Please check your inbox (and spam folder) and click the link.');
      } else {
        setSuccess('Email verified successfully! Welcome to SleekChat.');
      }
    } catch (err) {
      console.error('[VerifyEmail] Check error:', err);
      setError('Unable to check verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const emailDisplay = currentUser?.email || 'your email address';

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl border border-slate-800 text-center animate-in fade-in duration-300">
      {/* Icon */}
      <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-600/10">
        <MailCheck className="w-8 h-8 text-indigo-400 animate-bounce" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-100">Verify Your Email</h1>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
        {message}
      </p>

      {/* Recipient Email Badge */}
      <div className="my-4 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-indigo-300 text-sm font-semibold truncate">
        <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="truncate">{emailDisplay}</span>
      </div>

      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
        Click the link in the email to activate your account. If you don't see it within a minute, check your spam or junk folder.
      </p>

      {/* Success Notification */}
      {success && (
        <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-start gap-2.5 text-emerald-200 text-xs text-left">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl flex items-start gap-2.5 text-red-200 text-xs text-left">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Check Verification / Continue Button */}
        <button
          onClick={handleCheckVerified}
          disabled={checking}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
        >
          {checking ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Checking status...</span>
            </>
          ) : (
            <>
              <span>I have verified</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Resend Verification Email Button */}
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {resending ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sending email...</span>
            </>
          ) : cooldown > 0 ? (
            <span>Resend email in {cooldown}s</span>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Resend Verification Email</span>
            </>
          )}
        </button>
      </div>

      {/* Logout / Switch Account */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center">
        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Wrong email or want to sign in with another account?</span>
        </button>
      </div>
    </div>
  );
}
