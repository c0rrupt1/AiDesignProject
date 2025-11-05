import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_id,
      project_code,
      items,
      tax_amount = 0,
      discount_amount = 0,
      due_date,
      description,
      notes,
      terms,
    } = body;

    // Validate required fields
    if (!customer_id || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate invoice number
    const { data: invoiceNumber } = await supabaseAdmin
      .rpc("generate_invoice_number");

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        customer_id,
        project_code,
        invoice_number: invoiceNumber,
        status: "draft",
        tax_amount,
        discount_amount,
        due_date,
        description,
        notes,
        terms,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    // Create line items
    const lineItems = items.map((item: any, index: number) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      amount: (item.quantity || 1) * item.unit_price,
      item_type: item.item_type,
      sort_order: index,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .insert(lineItems);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      // Rollback invoice creation
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: "Failed to create invoice items" },
        { status: 500 }
      );
    }

    // Get updated invoice with calculated totals
    const { data: updatedInvoice } = await supabaseAdmin
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", invoice.id)
      .single();

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error("Error in create invoice API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
