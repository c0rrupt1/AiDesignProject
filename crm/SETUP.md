# Atomic CRM Setup Guide for crm.deckd.us

## What Was Done

The temporary CRM has been replaced with **Atomic CRM** - a full-featured, modular CRM built with React, shadcn/ui, and Supabase.

### Changes Made:

1. **Replaced CRM Source Code**: The `crm/src` directory now contains the complete Atomic CRM application
2. **Updated Configuration**: 
   - Updated `package.json` with all Atomic CRM dependencies
   - Configured Vite with Tailwind CSS and proper TypeScript settings
   - Set up path aliases for clean imports
3. **Environment Setup**: Created `.env.local` template for Supabase configuration
4. **Next.js Integration**: Updated `/web/src/app/crm/page.tsx` to embed the CRM via iframe
5. **Middleware**: The existing middleware already routes crm.deckd.us correctly
6. **Supabase Migrations**: Copied database migrations to `crm/supabase/` directory

## Next Steps

### 1. Configure Environment Variables

Create or update `crm/.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_IS_DEMO=false
VITE_INBOUND_EMAIL=optional-email@your-domain.com
```

These should match the environment variables in your main web app.

### 2. Set Up Supabase Database

Atomic CRM requires specific database tables. You have two options:

#### Option A: Use Supabase CLI (Recommended)
```bash
cd crm/supabase
supabase link --project-ref your-project-ref
supabase db push
```

#### Option B: Manual Setup
1. Go to your Supabase dashboard
2. Run the SQL migrations from `crm/supabase/migrations/`
3. Set up Row Level Security (RLS) policies
4. Create storage bucket named "attachments"

See the [Atomic CRM Supabase docs](https://github.com/marmelab/atomic-crm/tree/main/supabase) for detailed schema information.

### 3. Development Workflow

#### Start the CRM development server:
```bash
cd crm
npm run dev
```

This starts Vite on port 5174.

#### Start the Next.js app:
```bash
cd web
npm run dev
```

The Next.js app on crm.deckd.us (via middleware) will embed the CRM in an iframe pointing to `localhost:5174`.

### 4. Production Deployment

For production, you have several options:

#### Option 1: Separate Deployment (Recommended)
1. Build the CRM: `cd crm && npm run build`
2. Deploy the `crm/dist/` folder to a static hosting service (Vercel, Netlify, Cloudflare Pages)
3. Update the Next.js page to point to your deployed CRM URL via `NEXT_PUBLIC_CRM_APP_URL`

#### Option 2: Serve from Next.js
1. Build the CRM: `cd crm && npm run build`
2. Copy `crm/dist/*` to `web/public/crm-app/`
3. Update the Next.js page to serve from `/crm-app`

#### Option 3: Subdomain with Reverse Proxy
1. Deploy CRM separately
2. Configure your hosting to route crm.deckd.us to the CRM deployment
3. Remove the iframe approach and use direct routing

## Customization

### Basic Customization

Edit `crm/src/App.tsx` to customize:
- Company name and branding
- Logo (add to `crm/public/` and reference in App.tsx)
- Deal stages and categories
- Task types
- Contact fields
- Theme colors

Example:
```tsx
const App = () => (
  <CRM
    title="deckd CRM"
    lightModeLogo="/img/logo-light.png"
    darkModeLogo="/img/logo-dark.png"
    dealStages={[
      { id: 'lead', label: 'Lead', color: '#ccc' },
      { id: 'qualified', label: 'Qualified', color: '#4CAF50' },
      // ... more stages
    ]}
    disableTelemetry={true}
  />
);
```

### Advanced Customization

For deeper customization:
- Edit components in `crm/src/components/atomic-crm/`
- Modify data providers in `crm/src/components/atomic-crm/providers/`
- See [Atomic CRM docs](https://github.com/marmelab/atomic-crm/blob/main/doc/src/content/docs/developers/customizing.mdx)

## Troubleshooting

### CRM doesn't load in development
- Ensure the Vite dev server is running on port 5174
- Check that `NEXT_PUBLIC_CRM_APP_URL` is set correctly (or defaults to localhost:5174)

### Database connection errors
- Verify your Supabase credentials in `.env.local`
- Ensure all required tables are created
- Check RLS policies are set up correctly

### Build errors
- Run `npm install` in the crm directory
- Ensure TypeScript config is correct
- Check that test files aren't being included in build

## Features Available

With Atomic CRM, you now have:
- 📇 Contact and company management
- 💼 Deal pipeline with Kanban board
- ✅ Task management with reminders
- 📝 Notes and activity logging
- 📧 Email integration (optional)
- 📊 Dashboard with analytics
- 🔍 Full-text search
- 📥 Import/Export functionality
- 🎨 Theme customization
- 🔐 Built-in authentication

## Resources

- [Atomic CRM GitHub](https://github.com/marmelab/atomic-crm)
- [Atomic CRM Documentation](https://github.com/marmelab/atomic-crm/tree/main/doc)
- [Supabase Documentation](https://supabase.com/docs)
- [React Admin Docs](https://marmelab.com/react-admin/) (underlying framework)
