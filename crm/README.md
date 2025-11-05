# deckd CRM (Vite)

This directory hosts the next-generation CRM, built with Vite, React, and TypeScript.

## Commands

- `npm run dev --workspace crm` – start the local dev server on port 5174.
- `npm run build --workspace crm` – type-check and create a production build.
- `npm run preview --workspace crm` – preview the production build.
- `npm run lint --workspace crm` – placeholder until linting arrives.

## Next Steps

1. Hook up Supabase environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.).
2. Port authentication/profile helpers from the existing Next.js CRM.
3. Rebuild dashboards, upload workflows, and invoicing flows with modular components.
4. Configure dedicated Vercel project targeting the `crm/` directory.
