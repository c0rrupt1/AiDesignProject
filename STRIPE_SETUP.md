# Stripe Integration Setup Guide

## Overview

This guide will help you set up the complete Stripe integration for deckd that includes:
- Invoice management in the CRM
- Customer payment portal in the web app
- Booking/appointment times
- Payment plans and installments
- Automated webhook handling

## Architecture

```
┌─────────────────────────┐         ┌──────────────────┐
│   Customer Portal (web) │         │   CRM Dashboard  │
│  - View invoices        │         │  - Create invoices│
│  - Pay invoices         │         │  - Manage payments│
│  - View bookings        │         │  - Track status   │
│  - Book appointments    │         │  - View bookings  │
└──────────┬──────────────┘         └────────┬─────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          │
                   ┌──────▼──────┐
                   │  Supabase   │
                   │  Database   │
                   └──────┬──────┘
                          │
           ┌──────────────┼───────────────┐
           │              │               │
    ┌──────▼──────┐  ┌───▼────┐   ┌──────▼───────┐
    │  Invoices   │  │Payments│   │   Bookings   │
    └─────────────┘  └────────┘   └──────────────┘
                          │
                   ┌──────▼──────┐
                   │    Stripe   │
                   │  (Webhooks) │
                   └─────────────┘
```

## Step 1: Supabase Database Setup

### 1.1 Run the Migration

Run the SQL migration to create all necessary tables:

```bash
# Option A: Using Supabase CLI
cd supabase-setup
supabase db push

# Option B: Manual execution
# 1. Go to your Supabase Dashboard
# 2. Navigate to SQL Editor
# 3. Copy and paste the contents of:
#    supabase-setup/migrations/001_stripe_integration.sql
# 4. Execute the query
```

This creates the following tables:
- `invoices` - Invoice records with Stripe integration
- `invoice_items` - Line items for invoices
- `payments` - Payment tracking linked to Stripe
- `bookings` - Appointment/booking times
- `payment_plans` - Installment payment plans

### 1.2 Set Up Row Level Security (RLS)

The migration includes RLS policies, but you need to ensure staff users have the correct role:

```sql
-- Update a user to be staff (in Supabase SQL Editor)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"staff"'
)
WHERE email = 'your-staff-email@example.com';
```

### 1.3 Create Storage Bucket for Invoice PDFs (Optional)

```sql
-- Create bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false);

-- Set up RLS for the bucket
CREATE POLICY "Users can view own invoice PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR
   EXISTS (
     SELECT 1 FROM auth.users
     WHERE auth.users.id = auth.uid()
     AND auth.users.raw_user_meta_data->>'role' = 'staff'
   ))
);
```

## Step 2: Stripe Configuration

### 2.1 Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API keys**
3. Copy your **Secret key** and **Publishable key**
4. For testing, use the **Test mode** keys

### 2.2 Set Up Environment Variables

Add these to your environment (`.env.local` for local, and your hosting platform for production):

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_... for production)
STRIPE_WEBHOOK_SECRET= (we'll set this in step 2.4)

# Supabase Keys (if not already set)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_URL=http://localhost:3000 (or your production URL)
```

### 2.3 Install Stripe CLI (for local webhook testing)

```bash
# Install Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Other platforms:  https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login
```

### 2.4 Set Up Webhooks

#### For Local Development:

```bash
# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will output a webhook signing secret like:
# whsec_...
# Copy this and add it to your .env.local as STRIPE_WEBHOOK_SECRET
```

#### For Production:

1. Go to **Stripe Dashboard > Developers > Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select the following events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
   - `charge.refunded`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.created`
5. Copy the **Signing secret** and add it to your environment as `STRIPE_WEBHOOK_SECRET`

## Step 3: CRM Invoice Management Setup

The CRM needs to be able to create and manage invoices. You have two options:

### Option A: Add Invoice Management to Atomic CRM

Since Atomic CRM is built with React Admin, you can add custom resources. Create these files in your `crm/src/` directory:

**crm/src/components/invoices/InvoiceList.tsx:**
```tsx
import { List, Datagrid, TextField, NumberField, DateField, FunctionField } from 'react-admin';

export const InvoiceList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="invoice_number" />
      <TextField source="customer_name" />
      <NumberField source="total_amount" options={{ style: 'currency', currency: 'USD' }} />
      <TextField source="status" />
      <DateField source="due_date" />
      <DateField source="created_at" />
    </Datagrid>
  </List>
);
```

Then register it in your CRM's resources.

### Option B: Use the Existing CRM Components

The temporary CRM components in `web/src/components/crm/` can be updated to include invoice management. You'll need to add:

1. Invoice list view
2. Invoice create/edit form
3. Payment tracking dashboard

## Step 4: Customer Portal Integration

### 4.1 Create Invoice Display Component

Create `web/src/components/customer/InvoiceList.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient';

export function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const supabase = getBrowserSupabaseClient();

  useEffect(() => {
    async function loadInvoices() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('customer_id', user.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInvoices(data);
      }
    }

    loadInvoices();
  }, [supabase]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Invoices</h2>
      {invoices.map((invoice: any) => (
        <div key={invoice.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{invoice.invoice_number}</h3>
              <p className="text-sm text-gray-600">{invoice.description}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                ${(invoice.total_amount / 100).toFixed(2)}
              </div>
              <span className={`text-sm px-2 py-1 rounded ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {invoice.status}
              </span>
            </div>
          </div>

          {invoice.status !== 'paid' && invoice.amount_due > 0 && (
            <button
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              onClick={() => handlePayment(invoice.id)}
            >
              Pay ${(invoice.amount_due / 100).toFixed(2)}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

async function handlePayment(invoiceId: string) {
  // Implement Stripe payment flow
  // This will redirect to Stripe Checkout or use Elements
  window.location.href = `/customer/invoices/${invoiceId}/pay`;
}
```

### 4.2 Create Payment Page

Create `web/src/app/customer/invoices/[id]/pay/page.tsx` for the Stripe Checkout integration.

## Step 5: Booking Times Setup

### 5.1 Create Booking Component

Create `web/src/components/customer/BookingCalendar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient';

export function BookingCalendar() {
  const [bookings, setBookings] = useState([]);
  const supabase = getBrowserSupabaseClient();

  async function createBooking(bookingData: any) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: user.user.id,
        ...bookingData,
      })
      .select()
      .single();

    if (!error) {
      // Booking created successfully
      setBookings([...bookings, data]);
    }
  }

  // Implement calendar UI and booking logic
  return <div>Booking Calendar Component</div>;
}
```

### 5.2 Add to Customer Portal

Add the booking component to your customer portal page:

```tsx
// In web/src/app/customer/page.tsx
import { BookingCalendar } from '@/components/customer/BookingCalendar';

export default function CustomerPortal() {
  return (
    <div>
      {/* Other portal content */}
      <BookingCalendar />
    </div>
  );
}
```

## Step 6: Testing

### 6.1 Test Invoice Creation (CRM)

1. Log in to the CRM as staff
2. Create a new invoice with line items
3. Assign it to a customer
4. Verify it appears in Supabase

### 6.2 Test Payment Flow (Customer Portal)

1. Log in as a customer
2. View invoices
3. Click "Pay" on an invoice
4. Use Stripe test card: `4242 4242 4242 4242`
5. Verify payment success and invoice status update

### 6.3 Test Webhooks

```bash
# Trigger a test webhook
stripe trigger payment_intent.succeeded

# Check your logs to see if the webhook was processed
```

### 6.4 Test Bookings

1. Create a booking as a customer
2. Verify it appears in the CRM
3. Update booking status from CRM
4. Verify customer sees the update

## Step 7: Stripe Test Cards

Use these test cards for development:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`
- **Insufficient funds**: `4000 0000 0000 9995`

Use any future expiry date and any 3-digit CVC.

## Troubleshooting

### Webhook Not Receiving Events

1. Check that `STRIPE_WEBHOOK_SECRET` is set correctly
2. Verify the webhook URL is accessible
3. Check Stripe Dashboard > Webhooks for failed attempts
4. Ensure raw body parsing is enabled for the webhook route

### Payments Not Updating Invoice Status

1. Check Supabase logs for errors
2. Verify RLS policies allow updates
3. Check that `SUPABASE_SERVICE_ROLE_KEY` is set
4. Look at webhook event logs in Stripe Dashboard

### Customer Can't See Invoices

1. Verify RLS policies are set up correctly
2. Check that `customer_id` matches the authenticated user
3. Ensure user is logged in
4. Check browser console for errors

## Next Steps

1. **Add PDF Generation**: Generate PDF invoices using a library like `pdfkit` or `react-pdf`
2. **Email Notifications**: Send invoice and payment confirmation emails
3. **Recurring Invoices**: Implement subscription-based invoicing
4. **Advanced Reporting**: Add analytics dashboard for revenue tracking
5. **Mobile App**: Consider building a React Native app for customers

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [React Admin Documentation](https://marmelab.com/react-admin/)

## Support

For issues:
1. Check Stripe Dashboard for webhook and payment logs
2. Check Supabase logs for database errors
3. Review browser console for client-side errors
4. Check server logs for API route errors
