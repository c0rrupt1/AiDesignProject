import Link from "next/link";
import { GeneratedImagesProvider } from "@/components/providers/GeneratedImagesProvider";
import { ProjectCodePanel } from "@/components/project/ProjectCodePanel";
import { RecentMakeoversStrip } from "@/components/workspace/RecentMakeoversStrip";

type Feature = {
  name: string;
  headline: string;
  description: string;
  href: string;
  cta: string;
  highlights: string[];
};

const features: Feature[] = [
  {
    name: "Workspace",
    headline: "Design with live masking, side-by-side comparisons, and redo loops.",
    description:
      "Upload a room photo, sketch transformation zones, and iterate until the render feels right. The workspace keeps every variation in reach.",
    href: "/workspace",
    cta: "Open Workspace",
    highlights: [
      "Mask painter with paint & erase tools",
      "Prompt templates tuned for interiors",
      "Smart redo powered by feedback notes",
    ],
  },
  {
    name: "Shopping Assistant",
    headline: "Turn any render into shoppable keywords and ranked product hits.",
    description:
      "Crop the makeover, ask for descriptive keywords, and pull live shopping results. CLIP scores help you see which items stay on brief.",
    href: "/workspace#shopping",
    cta: "Explore Shopping",
    highlights: [
      "AI keyword extraction for cropped regions",
      "SerpAPI product lookups with pricing",
      "Similarity scoring using CLIP embeddings",
    ],
  },
  {
    name: "Project Requests",
    headline: "Collect project briefs directly from clients and collaborators.",
    description:
      "Use the request form to capture context, contact details, and goals so the studio team can jump into the right workspace instantly.",
    href: "/request",
    cta: "Send a Request",
    highlights: [
      "Structured lead capture fields",
      "Validation and helpful status messaging",
      "Directly integrated with the workspace tools",
    ],
  },
];

export default function LandingPage() {
  return (
    <GeneratedImagesProvider>
      <LandingPageInner />
    </GeneratedImagesProvider>
  );
}

function LandingPageInner() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.1),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-400/25 blur-[160px]" />
      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 pb-24 pt-24 md:px-10">
        <section className="space-y-10 rounded-[2.5rem] border border-white/10 bg-slate-950/70 p-10 shadow-[0_42px_160px_-90px_rgba(15,23,42,1)] ring-1 ring-white/10 md:p-14">
          <p className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.5em] text-amber-200">
            Interior makeover studio
          </p>
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
              One hub for designing, sourcing, and sharing each room&apos;s next look.
            </h1>
            <p className="max-w-3xl text-base text-slate-300 md:text-lg">
              Whether you&apos;re refreshing a single nook or orchestrating a whole-home transformation,
              the studio keeps creative exploration organised. Jump into the workspace, spin up shopping
              leads, and route polished requests without losing context.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-200">
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              Guided workflows
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              AI-assisted detailing
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              Connected requests
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center rounded-full border border-amber-300/60 bg-amber-400/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-amber-100 transition hover:bg-amber-400/30"
            >
              Launch Workspace
            </Link>
            <Link
              href="/request"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:bg-white/10"
            >
              Request a Project
            </Link>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          {features.map((feature) => (
            <FeatureCard key={feature.name} feature={feature} />
          ))}
        </section>

        <ProjectCodePanel className="mt-4" />

        <RecentMakeoversStrip className="mt-4" />

        <section className="rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-10 text-slate-200 ring-1 ring-white/10 md:p-14">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                Workflow in sync
              </p>
              <h2 className="text-3xl font-semibold text-slate-50 md:text-4xl">
                Keep ideation, sourcing, and client hand-off in the same flow.
              </h2>
              <p className="text-base text-slate-300 md:text-lg">
                The makeover workspace shares state with shopping searches and ingest-ready project briefs,
                so every iteration has a next step. Bring your own references, experiment with different
                prompts, and convert favourites into actionable specs.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-sm text-slate-300 shadow-inner shadow-black/40">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/60 bg-amber-400/20 text-xs font-semibold text-amber-100">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">Design the makeover</p>
                    <p className="text-xs text-slate-400">
                      Mask areas to restyle, guide the prompt, and compare each AI render without leaving the canvas.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-300/60 bg-sky-400/20 text-xs font-semibold text-sky-100">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">Source the details</p>
                    <p className="text-xs text-slate-400">
                      Crop the best angle, ask for keywords, and pull matching products ranked by similarity scores.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/20 text-xs font-semibold text-emerald-100">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">Share the plan</p>
                    <p className="text-xs text-slate-400">
                      Collect project briefs or hand off renders with notes so collaborators understand the next move.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.35em]">
                  Session history
                </span>
                <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.35em]">
                  Detailed prompts
                </span>
                <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.35em]">
                  Export-ready crops
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article className="flex h-full flex-col gap-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 ring-1 ring-white/10 transition hover:translate-y-[-4px] hover:bg-slate-950/60">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
          {feature.name}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-50">
          {feature.headline}
        </h2>
        <p className="mt-3 text-sm text-slate-400">{feature.description}</p>
      </div>
      <ul className="space-y-2 text-xs text-slate-300">
        {feature.highlights.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={feature.href}
        className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:bg-white/10"
      >
        {feature.cta}
        <span aria-hidden="true">{">"}</span>
      </Link>
    </article>
  );
}
