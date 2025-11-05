# Vercel Build Fix

## The Problem

Vercel build was failing with:
```
TypeError: Cannot read properties of null (reading 'useContext')
Error occurred prerendering page "/404"
```

This happens because Next.js tries to statically generate error pages at build time, but React Context (used by SupabaseAuthProvider) can't be used during static generation.

## What I Fixed

### 1. Added Custom Error Pages

Created three error handling pages that don't use React Context:

- **[web/src/app/not-found.tsx](web/src/app/not-found.tsx)** - Custom 404 page
- **[web/src/app/error.tsx](web/src/app/error.tsx)** - Error boundary
- **[web/src/app/global-error.tsx](web/src/app/global-error.tsx)** - Global error handler

These are simple, static pages that won't cause build errors.

### 2. Marked Auth Pages as Dynamic

Updated pages that use authentication context to force dynamic rendering:

- **[web/src/app/crm/page.tsx](web/src/app/crm/page.tsx)** - Added `export const dynamic = 'force-dynamic';`
- **[web/src/app/customer/page.tsx](web/src/app/customer/page.tsx)** - Added `export const dynamic = 'force-dynamic';`

This prevents Next.js from trying to statically generate these pages at build time.

## Next Steps

### Push These Changes

```bash
git add .
git commit -m "Fix Vercel build: Add custom error pages and force dynamic rendering"
git push
```

### Verify Build on Vercel

1. Go to your Vercel dashboard
2. The build should now succeed
3. The deployment should complete successfully

## If Build Still Fails

If you still see build errors, check:

1. **Environment Variables**: Make sure all required env vars are set in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for API routes)
   - `STRIPE_SECRET_KEY` (if using Stripe features)
   - `STRIPE_WEBHOOK_SECRET` (for webhooks)

2. **Check Build Logs**: Look for specific errors in the Vercel build logs

3. **Force Static Page Generation OFF**: Add to `next.config.ts`:
   ```typescript
   const nextConfig: NextConfig = {
     output: 'standalone', // or 'export' depending on your needs
     // ... other config
   };
   ```

## How Dynamic Rendering Works

When you add `export const dynamic = 'force-dynamic';` to a page:
- Next.js won't try to statically generate it at build time
- The page is rendered on-demand when requested
- This is necessary for pages that use:
  - Authentication context
  - Session data
  - Real-time data
  - User-specific content

## Pages That Should Be Dynamic

✅ Already marked as dynamic:
- `/crm` - Uses iframe with dynamic URL
- `/customer` - Uses SupabaseAuthProvider

✅ Already client-side rendered (no issue):
- `/workspace` - Marked with `"use client"`

✅ Static (no auth context, can be pre-rendered):
- `/` - Homepage
- `/request` - Request form
- `/lookup` - Lookup page

## Testing Locally

Before pushing, test the build locally:

```bash
cd web
npm run build
```

If it builds successfully locally, it should work on Vercel too.

## Additional Notes

- The iframe approach for the CRM is fine and won't cause build issues
- Error pages are now simple and won't break the build
- Authentication context is only used in client components or dynamic pages
- All API routes are server-side only and don't affect the build

## Related Files

- Error pages: `web/src/app/{not-found,error,global-error}.tsx`
- Dynamic pages: `web/src/app/{crm,customer}/page.tsx`
- Auth provider: `web/src/components/customer/SupabaseAuthProvider.tsx`
