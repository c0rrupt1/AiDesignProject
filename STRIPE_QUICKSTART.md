# Stripe Integration - Quick Start

## What You Need To Do

### 1. Supabase Setup (5 minutes)

```bash
# Go to your Supabase Dashboard
# SQL Editor > New Query
# Copy/paste: supabase-setup/migrations/001_stripe_integration.sql
# Click "Run"
```

Then set yourself as staff:
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"staff"'
)
WHERE email = 'YOUR_EMAIL@example.com';
```

### 2. Stripe Setup (5 minutes)

1. Go to https://dashboard.stripe.com
2. Get your API keys from **Developers > API keys**
3. Add to `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase
```

### 3. Webhook Setup (2 minutes)

#### Local Development:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook secret (whsec_...) and add to .env.local:
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Production:
1. Stripe Dashboard > Developers > Webhooks > Add endpoint
2. URL: `https://yourdomain.com/api/stripe/webhook`
3. Events: Select all `payment_intent.*`, `charge.*`, `invoice.*`, `customer.*`
4. Copy signing secret to your production environment

### 4. Test It

1. Start your dev server: `npm run dev`
2. The webhook is ready at: `http://localhost:3000/api/stripe/webhook`
3. Invoice creation API: `POST /api/invoices/create`
4. Payment API: `POST /api/invoices/[id]/pay`

## What You Can Do Now

### In the CRM (crm.deckd.us):
- Create invoices for customers
- Add line items (services, products)
- Set payment terms and due dates
- View payment status
- Track bookings/appointments

### In Customer Portal (web):
- Customers view their invoices
- Pay invoices with Stripe
- View payment history
- Book consultation times
- See booking calendar

## Database Tables Created

- ✅ `invoices` - Invoice records
- ✅ `invoice_items` - Line items
- ✅ `payments` - Payment tracking
- ✅ `bookings` - Appointment times
- ✅ `payment_plans` - Payment installments

## API Routes Created

- ✅ `POST /api/stripe/webhook` - Stripe event handler
- ✅ `POST /api/invoices/create` - Create new invoice
- ✅ `POST /api/invoices/[id]/pay` - Process payment

## Next: Build the UI Components

You need to create:

1. **CRM Invoice Manager** (in Atomic CRM or separate):
   - Invoice list view
   - Create/edit invoice form
   - Line item management
   - Customer selection

2. **Customer Portal Pages**:
   - `/customer/invoices` - List invoices
   - `/customer/invoices/[id]` - View invoice details
   - `/customer/invoices/[id]/pay` - Payment page
   - `/customer/bookings` - Booking calendar

3. **Booking System** (both CRM and customer):
   - Calendar view
   - Time slot selection
   - Booking form
   - Status management

## Stripe Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Expiry: Any future date
- CVC: Any 3 digits

## Need Help?

See full details in `STRIPE_SETUP.md`
