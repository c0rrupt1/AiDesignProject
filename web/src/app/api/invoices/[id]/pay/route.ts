import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { payment_method_id, amount } = body;

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*, customer_id")
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    let stripeCustomerId = invoice.stripe_customer_id;

    if (!stripeCustomerId) {
      // Get customer email from auth.users
      const { data: user } = await supabaseAdmin
        .from("auth.users")
        .select("email")
        .eq("id", invoice.customer_id)
        .single();

      if (user?.email) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: invoice.customer_id,
          },
        });

        stripeCustomerId = customer.id;

        // Update invoice with Stripe customer ID
        await supabaseAdmin
          .from("invoices")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", id);
      }
    }

    // Create payment intent
    const paymentAmount = amount || invoice.amount_due;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: invoice.currency,
      customer: stripeCustomerId || undefined,
      payment_method: payment_method_id,
      confirm: true,
      metadata: {
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
      },
      return_url: `${process.env.NEXT_PUBLIC_URL}/customer/invoices/${id}`,
    });

    // Create payment record
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: paymentAmount,
        currency: invoice.currency,
        status: paymentIntent.status === "succeeded" ? "succeeded" : "processing",
        description: `Payment for invoice ${invoice.invoice_number}`,
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
    }

    return NextResponse.json({
      success: true,
      payment_intent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
      },
    });
  } catch (error: unknown) {
    console.error("Error processing payment:", error);
    const message =
      error instanceof Error ? error.message : "Payment processing failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
