"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Orbit } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";

function SsoCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithSso } = useAuth();

  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"verifying" | "success" | "failed">(
    "verifying",
  );

  useEffect(() => {
    let mounted = true;

    async function handleExchange() {
      if (!code) {
        if (mounted) {
          setError("Không tìm thấy mã xác thực SSO (authorization code).");
          setStatus("failed");
        }
        return;
      }

      const verifier =
        sessionStorage.getItem("sso_code_verifier") ||
        "git-pulse-default-pkce-verifier-client-side-auth";

      const result = await loginWithSso(code, verifier);

      if (mounted) {
        if (result.success) {
          sessionStorage.removeItem("sso_code_verifier");
          setStatus("success");
          setTimeout(() => {
            router.push("/");
          }, 800);
        } else {
          setError(
            result.error ||
              "Xác thực Single Sign-On qua Central Gateway thất bại.",
          );
          setStatus("failed");
        }
      }
    }

    handleExchange();

    return () => {
      mounted = false;
    };
  }, [code, loginWithSso, router]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md astral-card rounded-3xl p-8 border border-pulsar-cyan/30 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Đang đồng bộ phiên đăng nhập...
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Git Pulse đang xác thực danh tính của bạn thông qua Central
              Gateway SSO Hub.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Xác thực SSO thành công!
            </h2>
            <p className="text-xs text-slate-400">
              Đang chuyển bạn về phòng điều khiển Git Pulse...
            </p>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Xác thực SSO thất bại
            </h2>
            <p className="text-xs text-rose-400 font-medium">{error}</p>
            <div className="pt-2">
              <button
                onClick={() => router.push("/")}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                Quay lại trang chủ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Orbit className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <SsoCallbackHandler />
    </Suspense>
  );
}
