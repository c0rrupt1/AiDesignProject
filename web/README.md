## Interior Makeover Studio – Web

Next.js (App Router) front end + API route for AI-powered room restyling powered by OpenRouter (default model `google/gemini-2.5-flash-image-preview`). A shopping assistant tab crops your images and asks Gemma 3 for search-ready keywords.

### Prerequisites

- Node.js ≥ 18 (installed via `nvm` is recommended). This repo currently targets Node 22 LTS.
- An OpenRouter API key with access to image-capable models (e.g. `google/gemini-2.5-flash-image-preview`).

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables by creating `./.env.local`:

   ```bash
   OPENROUTER_API_KEY=your-primary-openrouter-api-key
   # Optional: swap to another image-capable model
   # OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image-preview
   # Optional: choose a different model for keyword extraction
   # OPENROUTER_KEYWORDS_MODEL=google/gemma-3-4b-it
   # Required for SerpAPI shopping lookups
   SERPAPI_KEY=your-serpapi-key
   # Optional: refine SerpAPI locale settings
   # SERPAPI_GL=us
   # SERPAPI_HL=en
   # SERPAPI_LOCATION=United States
   # Optional: override the API base (defaults to https://openrouter.ai/api/v1)
   # OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
   # Optional: set app attribution headers for the OpenRouter leaderboard
   # OPENROUTER_HTTP_REFERER=https://your-app-url.example
   # OPENROUTER_APP_TITLE=Interior Makeover Studio
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

### How it works

- `src/app/page.tsx` renders the UI for uploading a base photo and style prompt.
- On submit, the form posts to `/api/edit`, streaming the files as `multipart/form-data`.
- `src/app/api/edit/route.ts` forwards the request to OpenRouter (default model `google/gemini-2.5-flash-image-preview`) and returns a base64 data URL, blending results with the original image if a mask is supplied.
- The shopping side tab lets you crop any makeover (or the original upload) and `/api/keywords` sends that region to Gemma 3 4B for comma-separated shopping keywords.
- `/api/shopping` exchanges those keywords with SerpAPI’s Google Shopping endpoint and returns structured product hits to the client.
- `/api/clip-match` runs OpenAI’s CLIP embeddings (via `@xenova/transformers`) to score shopping photos against the original upload and return similarity scores alongside product hits.
- The UI previews generated images and keeps a local history for the session.
- Advanced controls (strength, guidance scale, diffusion steps, negative prompt, seed) are serialized and sent with the request to improve consistency and adherence to instructions.
- A built-in canvas mask painter lets you sketch white regions to restyle directly in the browser; unmasked pixels remain untouched.

### Customisation ideas

- Swap providers: extend `/api/edit` to dynamically pick between multiple OpenRouter models or providers.
- Persist sessions: cache generated designs with Supabase/Prisma so users can revisit them.
- Add auth & billing: gate usage behind magic links or integrate with Stripe for pay-per-render.
