"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User } from "../types";
import { api } from "./api";

export interface DevUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isGoogleChooserOpen: boolean;
  openGoogleChooser: () => void;
  closeGoogleChooser: () => void;
  login: (
    username: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (
    email: string,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  loginWithGoogle: (payload: {
    email?: string;
    name?: string;
    googleId?: string;
    credential?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithSso: (
    code: string,
    codeVerifier: string,
  ) => Promise<{ success: boolean; error?: string }>;
  initiateGatewaySso: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper for generating PKCE code challenge
async function generatePkce() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const verifier = Array.from(array, (dec) =>
    dec.toString(16).padStart(2, "0"),
  ).join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest("SHA-256", data);

  const hashArray = Array.from(new Uint8Array(hash));
  const base64 = btoa(String.fromCharCode.apply(null, hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { verifier, challenge: base64 };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(username, password);
      setUser(res.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register(username, email, password);
      setUser(res.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await api.auth.forgotPassword(email);
      return { success: true, message: res.message };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  const loginWithGoogle = async (payload: {
    email?: string;
    name?: string;
    googleId?: string;
    credential?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.auth.googleLogin(payload);
      setUser(res.user);
      setIsGoogleChooserOpen(false);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSso = async (code: string, codeVerifier: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.ssoCallback(code, codeVerifier);
      setUser(res.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    } finally {
      setIsLoading(false);
    }
  };

  const initiateGatewaySso = async () => {
    try {
      const { verifier, challenge } = await generatePkce();
      sessionStorage.setItem("sso_code_verifier", verifier);

      const gatewayBase =
        process.env.NEXT_PUBLIC_GATEWAY_CLIENT_URL || "http://localhost:5100";
      const redirectUri = `${window.location.origin}/auth/callback`;
      const state = Math.random().toString(36).substring(2, 15);

      const ssoUrl = `${gatewayBase}/auth/oauth/authorize?client_id=git-pulse&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

      window.location.href = ssoUrl;
    } catch (err) {
      alert(`Không thể khởi tạo luồng SSO: ${(err as Error).message}`);
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGoogleChooserOpen,
        openGoogleChooser: () => setIsGoogleChooserOpen(true),
        closeGoogleChooser: () => setIsGoogleChooserOpen(false),
        login,
        register,
        forgotPassword,
        loginWithGoogle,
        loginWithSso,
        initiateGatewaySso,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
