"use client";

import Image from "next/image";
import Link from "next/link";
import { useGeneratedImages } from "@/components/providers/GeneratedImagesProvider";

type RecentMakeoversStripProps = {
  title?: string;
  className?: string;
};

export function RecentMakeoversStrip({
  title = "Recent makeovers",
  className = "",
}: RecentMakeoversStripProps) {
  const { results, projectCode } = useGeneratedImages();

  if (!results || results.length === 0) {
    return null;
  }

  const latest = results.slice(0, 4);
  const heading = projectCode.trim()
    ? `${title} · ${projectCode.trim()}`
    : title;

  return (
    <section
      className={`rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
            Saved this session
          </p>
          <h2 className="text-lg font-semibold text-slate-50">{heading}</h2>
        </div>
        <Link
          href="/workspace"
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:bg-white/10"
        >
          Open workspace
        </Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {latest.map((item) => (
          <figure
            key={item.createdAt}
            className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
              <Image
                src={item.url}
                alt={`Generated makeover for ${item.prompt}`}
                fill
                className="object-cover"
                draggable={false}
                unoptimized
                sizes="(max-width: 768px) 100vw, 25vw"
              />
            </div>
            <figcaption className="space-y-1">
              <p className="font-medium text-slate-100">
                {item.prompt.slice(0, 80)}
                {item.prompt.length > 80 ? "..." : ""}
              </p>
              <p className="text-[0.7rem] text-slate-500">
                Saved at {new Date(item.createdAt).toLocaleTimeString()}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
