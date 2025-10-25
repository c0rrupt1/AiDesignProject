"use client";

import { FormEvent, useEffect, useState } from "react";
import { useGeneratedImages } from "@/components/providers/GeneratedImagesProvider";

type StatusState = {
  type: "success" | "info" | "warning";
  text: string;
} | null;

type ProjectCodePanelProps = {
  className?: string;
};

export function ProjectCodePanel({ className = "" }: ProjectCodePanelProps) {
  const { projectCode, setProjectCode, regenerateProjectCode, regenerateSessionId } =
    useGeneratedImages();
  const [draftCode, setDraftCode] = useState(projectCode);
  const [status, setStatus] = useState<StatusState>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  useEffect(() => {
    setDraftCode(projectCode);
    setStatus(null);
    setCopyState("idle");
  }, [projectCode]);

  const normalizedCode = projectCode.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftCode.trim();
    if (trimmed) {
      setProjectCode(trimmed);
      regenerateSessionId();
      setStatus({ type: "success", text: `Project code set to ${trimmed}.` });
      setCopyState("idle");
      return;
    }

    const generated = regenerateProjectCode();
    setDraftCode(generated);
    setStatus({
      type: "warning",
      text: `No code entered, generated ${generated} instead.`,
    });
    setCopyState("idle");
  };

  const handleGenerate = () => {
    const generated = regenerateProjectCode();
    setDraftCode(generated);
    setStatus({
      type: "success",
      text: `Generated new project code ${generated}. Share this with your workflow tools.`,
    });
    setCopyState("idle");
  };

  const handleCopy = async () => {
    const payload = normalizedCode || draftCode.trim();
    if (!payload) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.warn("Failed to copy project code", error);
      setCopyState("error");
    }
  };

  return (
    <section
      className={`rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-200 ring-1 ring-white/10 md:p-8 ${className}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
            Project code
          </p>
          <h2 className="text-xl font-semibold text-slate-50 md:text-2xl">
            Generate once, then reuse everywhere.
          </h2>
          <p className="text-xs text-slate-400 md:text-sm">
            This code links makeover blobs, the request form, and any external
            automations. Share it with n8n or collaborators so every touchpoint
            references the same workspace.
          </p>
          {normalizedCode && (
            <p className="text-[0.7rem] uppercase tracking-[0.3em] text-slate-500">
              Current code: {normalizedCode}
            </p>
          )}
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:w-auto md:min-w-[22rem]"
        >
          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Workspace code
          </label>
          <input
            value={draftCode}
            onChange={(event) => setDraftCode(event.target.value)}
            placeholder="HS-0516-ABCD"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="submit"
              className="rounded-full bg-amber-500 px-4 py-2 font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:bg-amber-400"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-full border border-white/15 px-4 py-2 font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:bg-white/10"
            >
              Generate new
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-white/15 px-4 py-2 font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:bg-white/10"
            >
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
          </div>
          {status && (
            <p
              className={`rounded-xl border px-3 py-2 text-xs ${
                status.type === "success"
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                  : status.type === "warning"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {status.text}
            </p>
          )}
          {copyState === "error" && (
            <p className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Add or generate a project code before copying.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
