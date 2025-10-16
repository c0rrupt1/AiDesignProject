export function HeroSection() {
  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/60 to-slate-900/20 p-10 shadow-[0_48px_140px_-72px_rgba(15,23,42,1)] ring-1 ring-white/10">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
            Interior AI
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Stage edited interiors, faster than moodboards or mockups.
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Upload a reference photo, paint the areas you want to transform, and generate layered makeovers you can compare, crop, and shop.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Step 1
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Upload & mark focus
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Import the photo of your space and paint the furniture or walls you’d like Gemma to restyle.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Step 2
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Describe the vibe
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Prompt with materials, palette, and mood—Gemma renders polished makeovers in seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Step 3
              </p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                Shop the look
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Generate keywords, filter CLIP matches, and jump straight to purchase-ready products.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-300 shadow-inner shadow-black/50">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
            Workflow cheatsheet
          </p>
          <ol className="mt-5 space-y-4">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-semibold text-amber-200">
                1
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  Mask precisely with the brush or eraser
                </p>
                <p className="text-xs text-slate-400">
                  Hold and drag to paint. Switch modes to erase any overpainting and reset when needed.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-semibold text-amber-200">
                2
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  Capture multiple variations
                </p>
                <p className="text-xs text-slate-400">
                  Every makeover you generate is saved below so you can compare prompts or reuse them for shopping.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-sm font-semibold text-amber-200">
                3
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  Crop before keywording
                </p>
                <p className="text-xs text-slate-400">
                  Highlight the hero object, then let Gemma return a merchandisable keyword list and CLIP-ranked matches.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
