## Interior Makeover Studio – Web

Next.js (App Router) front end + API route for AI-powered room restyling powered by Qwen’s `Qwen-Image-Edit-2509`.

### Prerequisites

- Node.js ≥ 18 (installed via `nvm` is recommended). This repo currently targets Node 22 LTS.
- A Hugging Face access token with permissions to call the Inference API.

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables by creating `./.env.local`:

   ```bash
   HUGGING_FACE_API_KEY=hf-your-token-here
   # Optional: change the default model
   # HUGGING_FACE_MODEL=Qwen/Qwen-Image-Edit-2509
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

### How it works

- `src/app/page.tsx` renders the UI for uploading a base photo and style prompt.
- On submit, the form posts to `/api/edit`, streaming the files as `multipart/form-data`.
- `src/app/api/edit/route.ts` forwards the request to Hugging Face’s Qwen Image Edit endpoint and returns a base64 data URL.
- The UI previews generated images and keeps a local history for the session.
- Advanced controls (strength, true CFG scale, guidance scale, diffusion steps, negative prompt, seed) are serialized and sent with the request to improve consistency and adherence to instructions.

### Customisation ideas

- Swap providers: abstract `/api/edit` so it can call Stability, Replicate, or Gemini image editing models.
- Persist sessions: cache generated designs with Supabase/Prisma so users can revisit them.
- Add auth & billing: gate usage behind magic links or integrate with Stripe for pay-per-render.
