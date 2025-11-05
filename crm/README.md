# deckd CRM

This is the deckd CRM built with Atomic CRM - a full-featured, modular CRM built with React, shadcn/ui, and Supabase.

## About Atomic CRM

Atomic CRM is a free and open-source CRM that provides:
- Contact and company management
- Deal pipeline with Kanban board
- Task management and reminders
- Notes and activity tracking
- Data import/export
- Full customization capabilities

Learn more at [github.com/marmelab/atomic-crm](https://github.com/marmelab/atomic-crm)

## Development Commands

From the project root:
- `cd crm && npm install` – install dependencies
- `cd crm && npm run dev` – start the local dev server on port 5174
- `cd crm && npm run build` – type-check and create a production build
- `cd crm && npm run preview` – preview the production build

## Configuration

### Environment Variables

Create a `.env.local` file in the `crm/` directory with:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_IS_DEMO=false
VITE_INBOUND_EMAIL=optional-email-for-note-capture
```

These should match your main project's Supabase configuration.

### Supabase Setup

Atomic CRM requires specific database tables and schemas. You'll need to:

1. Run the Supabase migrations from the Atomic CRM repository
2. Set up the required tables: contacts, companies, deals, tasks, notes, etc.
3. Configure Row Level Security (RLS) policies
4. Set up storage buckets for attachments

See the [Atomic CRM Supabase Configuration docs](https://github.com/marmelab/atomic-crm/tree/main/supabase) for details.

## Customization

The CRM is configured in [src/App.tsx](./src/App.tsx). You can customize:
- Logo and branding
- Deal stages and categories
- Task types
- Contact gender options
- Company sectors
- Theme colors

See the [Atomic CRM customization docs](https://github.com/marmelab/atomic-crm/blob/main/doc/src/content/docs/developers/customizing.mdx) for more details.

## Deployment

The CRM is accessible via crm.deckd.us and is routed through the Next.js middleware in the `web/` directory.

For production deployment:
1. Set environment variables in your hosting platform
2. Build the CRM: `cd crm && npm run build`
3. The built files will be in `crm/dist/`
4. Configure your hosting to serve these files for crm.deckd.us subdomain
