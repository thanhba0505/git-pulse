"use client";

import React from "react";
import { AiEngine } from "../../types";
import { Sparkles, Cpu, Globe, Zap, Languages } from "lucide-react";

interface CockpitAiConsoleProps {
  engine: AiEngine;
  onEngineChange: (engine: AiEngine) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  language: "vi" | "en";
  onLanguageChange: (lang: "vi" | "en") => void;
  onGenerate: () => void;
  isGenerating: boolean;
  webLlmProgressText?: string;
  webLlmProgressPercent?: number;
  hasPrs: boolean;
}

export function CockpitAiConsole({
  engine,
  onEngineChange,
  selectedModel,
  onModelChange,
  language,
  onLanguageChange,
  onGenerate,
  isGenerating,
  webLlmProgressText,
  webLlmProgressPercent,
  hasPrs,
}: CockpitAiConsoleProps) {
  const isWebLLM = engine === "WEB_LLM";

  return (
    <div className="astral-card rounded-2xl p-6 sm:p-7 border border-pulsar-violet/30 shadow-[0_0_35px_rgba(139,92,246,0.1)] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/25">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Bảng Điều Khiển AI Kép
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chọn lõi xử lý AI để chuyển đổi các PR & commit thành bản Standup
              ngắn gọn.
            </p>
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-1.5 bg-void-subtle px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
          <Languages className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={() => onLanguageChange("vi")}
            className={`px-1.5 py-0.5 rounded font-medium ${
              language === "vi"
                ? "text-cyan-300 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            VI
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => onLanguageChange("en")}
            className={`px-1.5 py-0.5 rounded font-medium ${
              language === "en"
                ? "text-cyan-300 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Engine Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Core 1: GitHub Models */}
        <button
          type="button"
          onClick={() => {
            onEngineChange("GITHUB_MODELS");
            onModelChange("gpt-4o-mini");
          }}
          className={`p-4 sm:p-5 rounded-xl text-left border transition-all ${
            engine === "GITHUB_MODELS"
              ? "bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              : "bg-void-subtle/60 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">
              GitHub Models Warp-Drive
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dùng chính token GitHub của bạn gọi endpoint Azure AI. Siêu nhanh,
            thông minh & không tốn key.
          </p>
        </button>

        {/* Core 2: WebLLM In-Browser */}
        <button
          type="button"
          onClick={() => {
            onEngineChange("WEB_LLM");
            onModelChange("Llama-3.2-1B-Instruct-q4f16_1-MLC");
          }}
          className={`p-4 sm:p-5 rounded-xl text-left border transition-all ${
            engine === "WEB_LLM"
              ? "bg-violet-950/40 border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
              : "bg-void-subtle/60 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold text-white">
              WebGPU Sub-Light Core
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Chạy mô hình trực tiếp trong trình duyệt qua WebGPU. 100% riêng tư,
            offline và zero token.
          </p>
        </button>
      </div>

      {/* Model Selection Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-mono">Model:</span>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-void-subtle border border-slate-700 text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono"
          >
            {isWebLLM ? (
              <>
                <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">
                  Llama 3.2 1B (Nhẹ ~600MB)
                </option>
                <option value="Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC">
                  Qwen 2.5 Coder 1.5B (Code Spec)
                </option>
              </>
            ) : (
              <>
                <option value="gpt-4o-mini">
                  gpt-4o-mini (Cực nhanh & sắc nét)
                </option>
                <option value="meta-llama-3.3-70b-instruct">
                  Llama 3.3 70B (Siêu mạnh mẽ)
                </option>
              </>
            )}
          </select>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerate}
          disabled={!hasPrs || isGenerating}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-void bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 hover:from-violet-300 hover:via-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_25px_rgba(139,92,246,0.35)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Zap className={`w-4 h-4 ${isGenerating ? "animate-bounce" : ""}`} />
          <span>
            {isGenerating ? "Đang tóm tắt..." : "Kích Hoạt Tóm Tắt Standup"}
          </span>
        </button>
      </div>

      {/* WebLLM Loading Progress Indicator */}
      {isGenerating && isWebLLM && (
        <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-violet-300 font-mono">
            <span>
              {webLlmProgressText || "Đang nạp mô hình vào WebGPU..."}
            </span>
            <span>
              {webLlmProgressPercent
                ? `${Math.round(webLlmProgressPercent * 100)}%`
                : "100%"}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-void overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
              style={{
                width: `${Math.round((webLlmProgressPercent || 0) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
