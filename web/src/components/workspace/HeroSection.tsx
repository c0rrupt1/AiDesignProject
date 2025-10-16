export function HeroSection() {
  return (
    <section className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-900/50 px-8 py-12 shadow-[0_42px_160px_-90px_rgba(15,23,42,1)] ring-1 ring-white/10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center">
        <div className="space-y-6">
          <p className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.5em] text-amber-200">
            Interior makeover studio
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
            A clearer, room-scale canvas for designing the makeover in your head.
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Drop in your space, paint where you want change, and watch Gemma render intent-matched edits.
            The workspace now maximises the preview so you can inspect lighting, materials, and fit at a glance.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-200">
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              Large format canvas
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              Inline mask painter
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
              Smart redo loops
            </span>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-sm text-slate-200 shadow-inner shadow-black/60">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
            How to work fast
          </p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">1. Upload & mask</p>
              <p className="mt-2 text-xs text-slate-400">
                Paint white over areas to transform—walls, furniture, décor. They update live as you draw.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">2. Prompt the vibe</p>
              <p className="mt-2 text-xs text-slate-400">
                Describe the mood, palette, and materials. Templates on the right jump-start ideas.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-100">3. Compare & shop</p>
              <p className="mt-2 text-xs text-slate-400">
                Variations stack below the canvas with a comparison slider. Crop any result to source matching products.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
