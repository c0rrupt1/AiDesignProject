## Interior Makeover Studio – Web

Next.js (App Router) front end + API route for AI-powered room restyling powered by Google AI Studio’s Imagen API (default model `models/gemini-2.5-flash-image`).

### Prerequisites

- Node.js ≥ 18 (installed via `nvm` is recommended). This repo currently targets Node 22 LTS.
- A Google AI Studio API key with access to the Imagen-capable endpoints.

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables by creating `./.env.local`:

   ```bash
   GOOGLE_AI_STUDIO_API_KEY=your-api-key
   # Optional: change the default model
   # GOOGLE_AI_STUDIO_MODEL_ID=models/gemini-2.5-flash-image
   # Optional: override the API host
   # GOOGLE_AI_STUDIO_HOST=https://generativelanguage.googleapis.com
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

### How it works

- `src/app/page.tsx` renders the UI for uploading a base photo and style prompt.
- On submit, the form posts to `/api/edit`, streaming the files as `multipart/form-data`.
- `src/app/api/edit/route.ts` forwards the request to Google AI Studio’s Imagen endpoint (default model `models/gemini-2.5-flash-image`) and returns a base64 data URL, blending results with the original image if a mask is supplied.
- The UI previews generated images and keeps a local history for the session.
- Advanced controls (strength, guidance scale, diffusion steps, negative prompt, seed) are serialized and sent with the request to improve consistency and adherence to instructions.
- A built-in canvas mask painter lets you sketch white regions to restyle directly in the browser; unmasked pixels remain untouched.

### Customisation ideas

- Swap providers: abstract `/api/edit` so it can call different Imagen or Gemini models without code changes.
- Persist sessions: cache generated designs with Supabase/Prisma so users can revisit them.
- Add auth & billing: gate usage behind magic links or integrate with Stripe for pay-per-render.
