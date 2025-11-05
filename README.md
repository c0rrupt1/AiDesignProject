## AiDesignProject

AI-assisted interior makeover studio built with Next.js. The app lets you upload
rooms, describe the vibe you want (e.g., “rustic lodge with reclaimed wood”), and
pipes the request through OpenRouter (default model `google/gemini-2.5-flash-image-preview`)
for image editing. The result is returned as an
updated room concept directly in the browser. Optional mask uploads let you
target the areas that should change.
Need quick sourcing help? A dedicated shopping tab lets you crop the photo and ask Gemma 3 for ready-to-paste shopping keywords.

### Repository layout

- `web/` – Next.js 15 (App Router + Tailwind) frontend and API routes for the public site.
- `crm/` – Vite + React skeleton for the next-generation CRM (currently minimal on purpose).
- `package/` – Reverse image search CLI + library.
- `.gitignore` – Base ignore list for Node, Python, and common tooling.

### Quick start

```bash
# install both workspaces
npm install

# run the public site
npm run dev:web

# run the CRM preview (new Vite app)
npm run dev:crm
```

Visit `http://localhost:3000` for the public site and `http://localhost:5174` for the barebones CRM preview.

When a photo is loaded you can paint a mask directly in the browser. White
strokes mark surfaces to redesign, while black areas stay untouched.

### CRM status

The `crm/` app is an empty canvas meant to replace the legacy CRM embedded in the Next.js project. It currently ships a simple landing screen and lightweight scaffolding:

- React + TypeScript via Vite.
- Scripts wired into the root `package.json` so you can build/deploy independently of `web/`.
- Placeholder copy outlining the migration checklist.

Next steps for the CRM:

1. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `crm/.env`.
2. Port shared Supabase + auth helpers into a reusable package (or import them directly for now).
3. Rebuild dashboard modules inside `crm/src/` without touching the public site.
4. Point a dedicated Vercel project at the `crm/` directory and wire the `crm.deckd.us` domain.

### Configuration

Copy `web/.env.example` to `web/.env.local` and fill in the required secrets (OpenRouter, Supabase, SerpAPI, Stripe, Vercel Blob).

The `/api/edit` route expects `multipart/form-data` with three fields:

- `image` – Required base photo to transform.
- `mask` – Optional, white regions mark pixels to replace, black leaves the original.
- `prompt` – Text instructions (style, mood, materials).
- `guidanceScale`, `strength`, `inferenceSteps`, `negativePrompt`, `seed` – Optional tuning fields sent from the UI (defaults are applied if omitted).
- The shopping tab uses `/api/keywords` to send a cropped image region to OpenRouter’s Gemma 3 4B model and returns comma-separated keywords you can paste into Google Shopping.
- `/api/shopping` proxies those keywords to SerpAPI’s Google Shopping endpoint so you can pull structured product hits without exposing your API key to the browser.
- `/api/request` stores quote submissions in Supabase and optionally backfills project metadata for the lookup portal.
- `/api/project/[code]` reads project metadata from Supabase (defaults to view `project_portal`) so clients can self-serve invoices, Stripe links, and scheduler URLs.
- `/api/clip-match` ranks shopping thumbnails against the reference photo with OpenAI’s CLIP (via `@xenova/transformers`) so you can see similarity scores without hitting SerpAPI again.

### Suggested next steps

- Add provider toggles (e.g., multiple OpenRouter models or self-hosted providers) and map outputs into the same response shape.
- Persist generated makeovers in a database so users can revisit previous designs.
- Layer in authentication + project sharing if multiple rooms are involved.
