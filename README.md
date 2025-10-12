## AiDesignProject

AI-assisted interior makeover studio built with Next.js. The app lets you upload
rooms, describe the vibe you want (e.g., “rustic lodge with reclaimed wood”), and
pipes the request to Google AI Studio’s Imagen models (default
`models/gemini-2.5-flash-image`) for image editing. The result is returned as an
updated room concept directly in the browser. Optional mask uploads let you
target the areas that should change.

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

Create a `.env.local` file in `web/` with your Google AI Studio key:

```bash
GOOGLE_AI_STUDIO_API_KEY=...
# Optional: override the target model (defaults to models/gemini-2.5-flash-image)
# GOOGLE_AI_STUDIO_MODEL_ID=models/your-model
# Optional: point at a different host (defaults to https://generativelanguage.googleapis.com)
# GOOGLE_AI_STUDIO_HOST=https://generativelanguage.googleapis.com
```

The `/api/edit` route expects `multipart/form-data` with three fields:

- `image` – Required base photo to transform.
- `mask` – Optional, white regions mark pixels to replace, black leaves the original.
- `prompt` – Text instructions (style, mood, materials).
- `guidanceScale`, `strength`, `inferenceSteps`, `negativePrompt`, `seed` – Optional tuning fields sent from the UI (defaults are applied if omitted).

### Suggested next steps

- Add provider toggles (e.g., OpenAI, Stability, Replicate) and map outputs into the same response shape.
- Persist generated makeovers in a database so users can revisit previous designs.
- Layer in authentication + project sharing if multiple rooms are involved.
