"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createE2EEIdentity,
  unlockE2EEIdentity,
  type E2EEBackup,
  type E2EEIdentity,
  type E2EEPublicKey,
} from "@/lib/e2ee";

type E2EEProfile = { publicKey: E2EEPublicKey | null; backup: E2EEBackup | null };

export function useE2EEIdentity(userId: string | undefined) {
  const [profile, setProfile] = useState<E2EEProfile | null>(null);
  const [identity, setIdentity] = useState<E2EEIdentity | null>(null);
  const [identityOwner, setIdentityOwner] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setIdentity(null);
    setIdentityOwner(null);
    setError(null);
    if (!userId) return () => { active = false; };
    setLoadingProfile(true);
    void fetch("/api/account/e2ee", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "E2EE_PROFILE_UNAVAILABLE");
        if (active) setProfile(result as E2EEProfile);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "E2EE_PROFILE_UNAVAILABLE");
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => { active = false; };
  }, [userId]);

  const register = useCallback(async (passphrase: string) => {
    if (!userId || !profile) throw new Error("E2EE_PROFILE_UNAVAILABLE");
    setBusy(true);
    setError(null);
    try {
      if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) throw new Error("E2EE_SECURE_CONTEXT_REQUIRED");
      const { identity: newIdentity, backup } = await createE2EEIdentity(passphrase);
      const response = await fetch("/api/account/e2ee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: newIdentity.publicKey, backup }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "E2EE_KEY_REGISTRATION_FAILED");
      setProfile({ publicKey: newIdentity.publicKey, backup });
      setIdentity(newIdentity);
      setIdentityOwner(userId);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "E2EE_KEY_REGISTRATION_FAILED";
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [profile, userId]);

  const unlock = useCallback(async (passphrase: string) => {
    if (!userId || !profile?.publicKey || !profile.backup) {
      setError("E2EE_BACKUP_UNAVAILABLE");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) throw new Error("E2EE_SECURE_CONTEXT_REQUIRED");
      const restoredIdentity = await unlockE2EEIdentity(profile.publicKey, profile.backup, passphrase);
      setIdentity(restoredIdentity);
      setIdentityOwner(userId);
      return true;
    } catch {
      setError("E2EE_UNLOCK_FAILED");
      return false;
    } finally {
      setBusy(false);
    }
  }, [profile, userId]);

  const lock = useCallback(() => {
    setIdentity(null);
    setIdentityOwner(null);
  }, []);

  return {
    profile,
    identity: identityOwner === userId ? identity : null,
    loadingProfile,
    busy,
    error,
    register,
    unlock,
    lock,
  };
}
