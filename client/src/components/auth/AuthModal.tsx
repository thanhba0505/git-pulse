"use client";

import React, { useState } from "react";
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
  Orbit,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export type AuthMode = "login" | "register" | "forgot";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  onOpenGoogleChooser?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  defaultMode = "login",
  onOpenGoogleChooser,
}: AuthModalProps) {
  const { login, register, forgotPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Vui lòng nhập tên đăng nhập hoặc email.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(
          result.error || "Tên đăng nhập hoặc mật khẩu không chính xác.",
        );
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
      setError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await register(username.trim(), email.trim(), password);
      if (!result.success) {
        setError(result.error || "Đăng ký tài khoản thất bại.");
      } else {
        setSuccessMessage("Đăng ký tài khoản thành công!");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      if (result.success) {
        setSuccessMessage(
          result.message || "Yêu cầu khôi phục mật khẩu đã được gửi.",
        );
      } else {
        setError(result.error || "Có lỗi xảy ra.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shadow-xs">
              <Orbit className="h-4 w-4 animate-spin-slow" />
            </div>
            <span className="text-base font-bold text-slate-900">
              {mode === "login" && "Đăng nhập Git-Pulse"}
              {mode === "register" && "Đăng ký tài khoản Git-Pulse"}
              {mode === "forgot" && "Khôi phục mật khẩu"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="font-medium leading-relaxed">
                {successMessage}
              </div>
            </div>
          )}

          {/* 1. VIEW: LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Optional Quick Dev Account Selector */}
              {onOpenGoogleChooser && (
                <button
                  type="button"
                  onClick={onOpenGoogleChooser}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50/80 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5 text-amber-700" />
                  Chọn tài khoản trong DB để test (Local Dev)
                </button>
              )}

              {/* Username or Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên đăng nhập hoặc Email{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: admin hoặc user@domain.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" />
                <span>{isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}</span>
              </button>

              {/* Divider: HOẶC TIẾP TỤC VỚI */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs font-mono uppercase text-slate-400">
                  Hoặc tiếp tục với
                </span>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={onOpenGoogleChooser}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-2xs cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập bằng tài khoản Google</span>
              </button>

              {/* Footer */}
              <div className="pt-2 text-center text-xs text-slate-500">
                Chưa có tài khoản Git-Pulse?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Đăng ký ngay
                </button>
              </div>
            </form>
          )}

          {/* 2. VIEW: REGISTER */}
          {mode === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đăng nhập (Username){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: developer_2026"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="VD: developer@domain.com"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu an toàn..."
                    className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
              >
                <ArrowRight className="h-4 w-4" />
                <span>
                  {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
                </span>
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Đã có tài khoản Git-Pulse?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              </div>
            </form>
          )}

          {/* 3. VIEW: FORGOT PASSWORD */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nhập địa chỉ Email tài khoản của bạn{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="VD: user@domain.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" />
                <span>
                  {isSubmitting
                    ? "Đang gửi yêu cầu..."
                    : "Gửi yêu cầu khôi phục"}
                </span>
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
