"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "loading" | "ready" | "error" | "submitting" | "done";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    async function verifyInvite() {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setStatus("error");
        setErrorMessage("This invite link is invalid or has expired.");
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else {
        setStatus("ready");
      }
    }

    verifyInvite();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("done");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-ink-900">Set your password</h1>
        <p className="mb-6 text-sm text-ink-500">Finish setting up your account.</p>

        {status === "loading" && <p className="text-sm text-ink-500">Verifying your invite…</p>}
        {status === "error" && <p className="text-sm text-danger-700">{errorMessage}</p>}

        {(status === "ready" || status === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" loading={status === "submitting"} className="w-full">
              Set password &amp; continue
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
