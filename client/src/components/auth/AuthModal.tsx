'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  Mail,
  AlertCircle,
  CheckCircle2,
  Database,
  Activity,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useTranslation } from '../../i18n';
import { ModalDialog } from '../ui/ModalDialog';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ShowcaseCard } from '../ui/ShowcaseCard';
import { GoogleSignInButton } from './GoogleSignInButton';

export type AuthMode = 'login' | 'register' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  variant?: 'modal' | 'inline';
  onOpenGoogleChooser?: () => void;
  externalError?: string | null;
}

export function AuthModal({
  isOpen,
  onClose,
  defaultMode = 'login',
  variant = 'modal',
  onOpenGoogleChooser,
  externalError,
}: AuthModalProps) {
  const { locale, setLocale, dict } = useTranslation();
  const { login, register, forgotPassword, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isClientDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  const handleGoogleSuccess = async (credential: string) => {
    setError(null);
    setSuccessMessage(null);
    const result = await loginWithGoogle({ credential });
    if (!result.success) {
      setError(result.error || dict.auth.googleAuthFailed);
    } else {
      onClose();
    }
  };

  if (!isOpen && variant === 'modal') return null;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError(dict.auth.errors.usernameRequired);
      return;
    }
    if (!password) {
      setError(dict.auth.errors.passwordRequired);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(result.error || dict.auth.errors.loginFailed);
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) {
      setError(dict.auth.errors.registerFieldsRequired);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await register(username.trim(), email.trim(), password);
      if (!result.success) {
        setError(result.error || dict.auth.errors.registerFailed);
      } else {
        setSuccessMessage(dict.auth.registerSuccess);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(dict.auth.errors.emailRequired);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      if (result.success) {
        setSuccessMessage(result.message || dict.auth.forgotSuccess);
      } else {
        setError(result.error || dict.auth.errors.forgotFailed);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const HeadingTag = variant === 'inline' ? 'h1' : 'h2';
  const titleText =
    mode === 'login'
      ? dict.auth.loginTitle
      : mode === 'register'
        ? dict.auth.registerTitle
        : dict.auth.forgotTitle;

  const cardContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-6 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-400 shrink-0"
            aria-hidden="true"
          >
            <Activity className="h-4 w-4" />
          </div>
          <HeadingTag
            id="auth-modal-title"
            className="text-base font-semibold text-slate-100 tracking-tight truncate"
          >
            {titleText}
          </HeadingTag>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            value={locale}
            onChange={setLocale}
            ariaLabel={dict.header.languageSwitchLabel}
            size="sm"
            options={[
              { value: 'vi', label: 'VI' },
              { value: 'en', label: 'EN' },
            ]}
          />

          {variant === 'modal' && (
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.common.close}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-700/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-7">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3.5 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" aria-hidden="true" />
            <div className="font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" aria-hidden="true" />
            <div className="font-medium leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* VIEW: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input
              label={dict.auth.usernameOrEmailLabel}
              requiredMark
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.usernameOrEmailPlaceholder}
              leftIcon={<User className="h-4 w-4" />}
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
            />

            <Input
              label={dict.auth.passwordLabel}
              requiredMark
              labelAction={
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
                >
                  {dict.auth.forgotPasswordLink}
                </button>
              }
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.passwordPlaceholder}
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="current-password"
              enterKeyHint="done"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? dict.auth.hidePassword : dict.auth.showPassword}
                  className="p-2 rounded-md text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="gp-cta-shimmer w-full min-h-[42px] flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold py-2.5 text-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSubmitting ? dict.auth.signingInBtn : dict.auth.signInBtn}</span>
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700/80" aria-hidden="true" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 shrink-0">
                {dict.auth.orSeparator}
              </span>
              <div className="h-px flex-1 bg-slate-700/80" aria-hidden="true" />
            </div>

            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(err) => setError(err)}
              disabled={isSubmitting}
              onDevChooserClick={onOpenGoogleChooser}
              isClientDev={isClientDev}
              mode="signin"
            />

            <div className="pt-2 text-center text-xs text-slate-400">
              {dict.auth.noAccount}{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                {dict.auth.registerNow}
              </button>
            </div>

            {isClientDev && onOpenGoogleChooser && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onOpenGoogleChooser}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{dict.auth.devAccountHelper}</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* VIEW: REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <Input
              label={dict.auth.usernameLabel}
              requiredMark
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.usernamePlaceholder}
              leftIcon={<User className="h-4 w-4" />}
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
            />

            <Input
              label={dict.auth.emailLabel}
              requiredMark
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.emailPlaceholder}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
            />

            <Input
              label={dict.auth.passwordLabel}
              requiredMark
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.registerPasswordPlaceholder}
              leftIcon={<Lock className="h-4 w-4" />}
              autoComplete="new-password"
              enterKeyHint="done"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? dict.auth.hidePassword : dict.auth.showPassword}
                  className="p-2 rounded-md text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="gp-cta-shimmer w-full min-h-[42px] flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold py-2.5 text-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSubmitting ? dict.auth.registeringBtn : dict.auth.registerBtn}</span>
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700/80" aria-hidden="true" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 shrink-0">
                {dict.auth.orSeparator}
              </span>
              <div className="h-px flex-1 bg-slate-700/80" aria-hidden="true" />
            </div>

            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(err) => setError(err)}
              disabled={isSubmitting}
              onDevChooserClick={onOpenGoogleChooser}
              isClientDev={isClientDev}
              mode="signup"
            />

            <div className="pt-2 text-center text-xs text-slate-400">
              {dict.auth.hasAccount}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                {dict.auth.signInNow}
              </button>
            </div>
          </form>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <Input
              label={dict.auth.forgotEmailLabel}
              requiredMark
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={dict.auth.emailPlaceholder}
              leftIcon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="gp-cta-shimmer w-full min-h-[42px] flex items-center justify-center gap-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold py-2.5 text-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSubmitting ? dict.auth.sendingResetBtn : dict.auth.sendResetBtn}</span>
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                {dict.auth.backToLogin}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );

  if (variant === 'inline') {
    return (
      <ShowcaseCard
        tiltStrength={0.75}
        className="w-full max-w-[440px] gp-modal-surface gp-dialog-in"
      >
        {cardContent}
      </ShowcaseCard>
    );
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="auth-modal-title"
      maxWidthClass="max-w-[440px]"
    >
      {cardContent}
    </ModalDialog>
  );
}
