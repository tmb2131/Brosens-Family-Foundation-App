"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NotificationPreferences } from "@/lib/types";

interface PushPreferencesResponse {
  preferences: NotificationPreferences;
  hasActiveSubscription: boolean;
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}

type PreferenceToggleKey = Exclude<keyof NotificationPreferences, "pushEnabled">;

const EVENT_TOGGLE_OPTIONS: Array<{
  key: PreferenceToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "proposalCreated",
    label: "New Proposal Submitted",
    description: "When a new proposal is created and waiting for review."
  },
  {
    key: "proposalReadyForMeeting",
    label: "Proposal Ready For Meeting",
    description: "When voting threshold is reached."
  },
  {
    key: "proposalStatusChanged",
    label: "Proposal Status Changed",
    description: "When proposal status changes to approved, declined, or sent."
  },
  {
    key: "policyUpdatePublished",
    label: "Mandate Policy Updates",
    description: "When mandate policy versions are published."
  },
  {
    key: "proposalApprovedForAdmin",
    label: "Admin Queue Alerts",
    description: "When a proposal is approved and ready for admin action."
  }
];

function isStandaloneDisplay() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export function PushSettingsCard() {
  const { data, error, mutate, isLoading } = useSWR<PushPreferencesResponse>(
    "/api/notifications/push/preferences"
  );

  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<PreferenceToggleKey | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hasSupport =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(hasSupport);
    setPermission(hasSupport ? Notification.permission : "unsupported");

    const syncStandalone = () => setStandalone(isStandaloneDisplay());
    syncStandalone();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncStandalone);
    } else {
      mediaQuery.addListener(syncStandalone);
    }

    window.addEventListener("focus", syncStandalone);

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", syncStandalone);
      } else {
        mediaQuery.removeListener(syncStandalone);
      }
      window.removeEventListener("focus", syncStandalone);
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!supported) {
      return "Push is not supported on this browser/device.";
    }

    if (!standalone) {
      return "Install this app to your home screen first to enable mobile push.";
    }

    if (!data?.pushConfigured) {
      return "Push is not configured on the server yet.";
    }

    if (permission === "denied") {
      return "Notification permission is denied in browser settings.";
    }

    if (!data?.hasActiveSubscription) {
      return "Push is available. Enable notifications below.";
    }

    return "Push notifications are active on this device.";
  }, [data?.hasActiveSubscription, data?.pushConfigured, permission, standalone, supported]);

  const enablePush = async () => {
    if (!supported) {
      return;
    }
    if (!standalone) {
      setMessage({
        tone: "error",
        text: "Add this app to your home screen, then open it from there to enable push."
      });
      return;
    }
    if (!data?.vapidPublicKey) {
      setMessage({
        tone: "error",
        text: "Missing VAPID public key. Configure push keys on the server."
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const registration = await registerServiceWorker();

      const nextPermission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("Permission was not granted.");
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey)
        }));

      const response = await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          platform: navigator.platform,
          userAgent: navigator.userAgent
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to subscribe for push notifications."));
      }

      await mutate();
      setMessage({
        tone: "success",
        text: "Push notifications are enabled for this device."
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to enable push notifications."
      });
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    if (!supported) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const existingSubscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      const response = await fetch("/api/notifications/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: existingSubscription?.endpoint
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to unsubscribe push notifications."));
      }

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const preferencesResponse = await fetch("/api/notifications/push/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pushEnabled: false })
      });
      if (!preferencesResponse.ok) {
        const payload = await preferencesResponse.json().catch(() => ({} as Record<string, unknown>));
        throw new Error(String(payload.error ?? "Failed to update push preference state."));
      }

      await mutate();
      setMessage({
        tone: "success",
        text: "Push notifications are disabled for this device."
      });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to disable push notifications."
      });
    } finally {
      setBusy(false);
    }
  };

  const updatePreference = async (key: PreferenceToggleKey, value: boolean) => {
    setSavingPreferenceKey(key);
    setMessage(null);

    try {
      const response = await fetch("/api/notifications/push/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to update notification preference."));
      }

      await mutate();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to update preference."
      });
    } finally {
      setSavingPreferenceKey(null);
    }
  };

  return (
    <GlassCard>
      <CardLabel>Mobile Push Notifications</CardLabel>
      {error ? <p className="mt-2 text-sm text-rose-600">{error.message}</p> : null}
      {isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading notification settings...</p> : null}

      {!isLoading && !error ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{statusLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permission:{" "}
            <span className="font-medium capitalize">
              {permission === "unsupported" ? "unsupported" : permission}
            </span>
          </p>

          {!standalone ? (
            <p className="mt-2 text-xs text-muted-foreground">
              iPhone/iPad: Share menu - Add to Home Screen. Android: browser menu - Install app.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void enablePush()}
              disabled={busy || !supported || !standalone || !data?.pushConfigured}
            >
              {busy ? "Working..." : "Enable Push"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void disablePush()}
              disabled={busy || !supported}
            >
              Disable Push
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Event Preferences
            </p>
            {EVENT_TOGGLE_OPTIONS.map((option) => {
              const checked = Boolean(data?.preferences?.[option.key]);
              const isDisabled =
                busy ||
                savingPreferenceKey === option.key ||
                !data?.preferences?.pushEnabled;
              return (
                <div key={option.key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={isDisabled}
                    onCheckedChange={(value) => void updatePreference(option.key, value)}
                  />
                </div>
              );
            })}
          </div>

          {message ? (
            <p className={`mt-2 text-xs ${message.tone === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {message.text}
            </p>
          ) : null}
        </>
      ) : null}
    </GlassCard>
  );
}
