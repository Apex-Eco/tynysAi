"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountSettingsFormProps = {
  initialName: string;
  email: string;
};

type SaveState = "idle" | "saving" | "success" | "error";

export function AccountSettingsForm({ initialName, email }: AccountSettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string>("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("saving");
    setMessage("");

    try {
      const payload: Record<string, string> = { name: name.trim() };

      if (newPassword.trim().length > 0) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const response = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Failed to update account settings");
      }

      setSaveState("success");
      setMessage(result?.message ?? "Settings saved");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="account-name" className="text-slate-200">User Name</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-slate-700 bg-slate-950 text-slate-100"
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-email" className="text-slate-200">Email</Label>
        <Input
          id="account-email"
          value={email}
          readOnly
          disabled
          className="border-slate-700 bg-slate-950 text-slate-400"
        />
      </div>

      <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-300">Change Password</h2>

        <div className="space-y-2">
          <Label htmlFor="current-password" className="text-slate-200">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="border-slate-700 bg-slate-900 text-slate-100"
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-slate-200">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="border-slate-700 bg-slate-900 text-slate-100"
            autoComplete="new-password"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saveState === "saving"} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
          {saveState === "saving" ? "Saving..." : "Save"}
        </Button>
        {message ? (
          <p className={saveState === "error" ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
