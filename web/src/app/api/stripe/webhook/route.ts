import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Initialize Supabase admin client for webhook handling
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", errorMessage);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  console.log(`Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "customer.created":
        await handleCustomerCreated(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook handler failed",
      },
      { status: 500 }
    );
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("PaymentIntent succeeded:", paymentIntent.id);

  let receiptUrl: string | null = null;
  const latestChargeId = paymentIntent.latest_charge;
  if (typeof latestChargeId === "string") {
    try {
      const charge = await stripe.charges.retrieve(latestChargeId);
      receiptUrl = charge.receipt_url ?? null;
    } catch (chargeError) {
      console.warn(
        `Unable to retrieve charge ${latestChargeId} for receipt URL:`,
        chargeError,
      );
    }
  }

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      receipt_url: receiptUrl,
    })
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating payment:", error);
    return;
  }

  // Update invoice if linked
  if (payment?.invoice_id) {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", payment.invoice_id)
      .single();

    if (invoice) {
      const newAmountPaid = invoice.amount_paid + payment.amount;
      const newAmountDue = invoice.total_amount - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? "paid" : invoice.status;

      await supabaseAdmin
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
          paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", payment.invoice_id);
    }
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("PaymentIntent failed:", paymentIntent.id);

  await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      failure_message: paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
  console.log("Charge succeeded:", charge.id);

  const paymentMethodDetails = charge.payment_method_details;
  const cardDetails =
    paymentMethodDetails?.type === "card" ? paymentMethodDetails.card ?? null : null;

  await supabaseAdmin
    .from("payments")
    .update({
      stripe_charge_id: charge.id,
      payment_method_type: charge.payment_method_details?.type || null,
      payment_method_last4: cardDetails?.last4 ?? null,
      payment_method_brand: cardDetails?.brand ?? null,
      receipt_url: charge.receipt_url ?? null,
    })
    .eq("stripe_payment_intent_id", charge.payment_intent as string);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("Invoice payment succeeded:", invoice.id);

  await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
    })
    .eq("stripe_invoice_id", invoice.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("Invoice payment failed:", invoice.id);

  await supabaseAdmin
    .from("invoices")
    .update({
      status: "overdue",
    })
    .eq("stripe_invoice_id", invoice.id);
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log("Customer created:", customer.id);

  // Update user metadata with Stripe customer ID if email matches
  if (customer.email) {
    const { data: user } = await supabaseAdmin
      .from("auth.users")
      .select("id")
      .eq("email", customer.email)
      .single();

    if (user) {
      // Store Stripe customer ID in user metadata or separate table
      await supabaseAdmin
        .from("invoices")
        .update({ stripe_customer_id: customer.id })
        .eq("customer_id", user.id)
        .is("stripe_customer_id", null);
    }
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log("Charge refunded:", charge.id);

  await supabaseAdmin
    .from("payments")
    .update({
      status: "refunded",
      stripe_refund_id: charge.refunds?.data[0]?.id || null,
    })
    .eq("stripe_charge_id", charge.id);

  // Update invoice status if needed
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("invoice_id, amount")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (payment?.invoice_id) {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", payment.invoice_id)
      .single();

    if (invoice) {
      const newAmountPaid = Math.max(0, invoice.amount_paid - payment.amount);
      const newAmountDue = invoice.total_amount - newAmountPaid;

      await supabaseAdmin
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newAmountDue === invoice.total_amount ? "refunded" : "sent",
          paid_at: null,
        })
        .eq("id", payment.invoice_id);
    }
  }
}
