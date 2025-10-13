## AiDesignProject

AI-assisted interior makeover studio built with Next.js. The app lets you upload
rooms, describe the vibe you want (e.g., “rustic lodge with reclaimed wood”), and
pipes the request through OpenRouter (default model `google/gemini-2.5-flash-image-preview`)
for image editing. The result is returned as an
updated room concept directly in the browser. Optional mask uploads let you
target the areas that should change.
Need quick sourcing help? A dedicated shopping tab lets you crop the photo and ask Gemma 3 for ready-to-paste shopping keywords.

### Repository layout

- `web/` – Next.js 15 (App Router + Tailwind) frontend and API route for image editing.
- `.gitignore` – Base ignore list for Node, Python, and common tooling.

### Quick start

```bash
# install dependencies
cd web
npm install

# run the dev server
npm run dev
```

Visit `http://localhost:3000` to try the UI.

When a photo is loaded you can paint a mask directly in the browser. White
strokes mark surfaces to redesign, while black areas stay untouched.

### Configuration

Create a `.env.local` file in `web/` with your OpenRouter credentials:

```bash
OPENROUTER_API_KEY=...
# Optional: override the target model (defaults to google/gemini-2.5-flash-image-preview)
# OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image-preview
# Optional: choose a different model for shopping keyword extraction
# OPENROUTER_KEYWORDS_MODEL=google/gemma-3-4b-it
# Required for Google Shopping lookup
SERPAPI_KEY=...
# Optional: refine SerpAPI locale settings
# SERPAPI_GL=us
# SERPAPI_HL=en
# SERPAPI_LOCATION=United States
# Optional: customize base URL or attribution headers
# OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
# OPENROUTER_HTTP_REFERER=https://your-app-url.example
# OPENROUTER_APP_TITLE=Interior Makeover Studio
```

The `/api/edit` route expects `multipart/form-data` with three fields:

- `image` – Required base photo to transform.
- `mask` – Optional, white regions mark pixels to replace, black leaves the original.
- `prompt` – Text instructions (style, mood, materials).
- `guidanceScale`, `strength`, `inferenceSteps`, `negativePrompt`, `seed` – Optional tuning fields sent from the UI (defaults are applied if omitted).
- The shopping tab uses `/api/keywords` to send a cropped image region to OpenRouter’s Gemma 3 4B model and returns comma-separated keywords you can paste into Google Shopping.
- `/api/shopping` proxies those keywords to SerpAPI’s Google Shopping endpoint so you can pull structured product hits without exposing your API key to the browser.
- `/api/clip-match` ranks shopping thumbnails against the reference photo with OpenAI’s CLIP (via `@xenova/transformers`) so you can see similarity scores without hitting SerpAPI again.

### Suggested next steps

- Add provider toggles (e.g., multiple OpenRouter models or self-hosted providers) and map outputs into the same response shape.
- Persist generated makeovers in a database so users can revisit previous designs.
- Layer in authentication + project sharing if multiple rooms are involved.
