## AiDesignProject

AI-assisted interior makeover studio built with Next.js. The app lets you upload
rooms, describe the vibe you want (e.g., “rustic lodge with reclaimed wood”), and
pipes the request to Hugging Face’s Stable Diffusion XL image-to-image endpoint.
The result is returned as an updated room concept directly in the browser.

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

### Configuration

Create a `.env.local` file in `web/` with your Hugging Face token:

```bash
HUGGING_FACE_API_KEY=hf_...
# Optional: override the model (defaults to stabilityai/stable-diffusion-xl-base-1.0)
# HUGGING_FACE_MODEL=owner/model-name
```

The `/api/edit` route expects `multipart/form-data` with three fields:

- `image` – Required base photo to transform.
- `prompt` – Text instructions (style, mood, materials).

### Suggested next steps

- Add provider toggles (e.g., OpenAI, Stability, Replicate) and map outputs into the same response shape.
- Persist generated makeovers in a database so users can revisit previous designs.
- Layer in authentication + project sharing if multiple rooms are involved.
