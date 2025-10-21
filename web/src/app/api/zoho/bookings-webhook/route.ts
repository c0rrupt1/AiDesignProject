import { NextRequest, NextResponse } from "next/server";

import {
  CreateWorkOrderInput,
  ServiceLineItemInput,
  WorkOrderCustomerInput,
  WorkOrderAppointmentInput,
  createFsmWorkOrder,
  ensureZohoAccessToken,
} from "@/lib/zoho";

type BookingPayload = Record<string, unknown>;

type NormalizedBooking = CreateWorkOrderInput;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.ZOHO_BOOKINGS_WEBHOOK_SECRET;
    if (secret) {
      const provided =
        req.headers.get("x-webhook-secret") ??
        extractBearerToken(req.headers.get("authorization"));

      if (provided !== secret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    let payload: BookingPayload;
    try {
      payload = (await req.json()) as BookingPayload;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    const normalized = normalizeBookingPayload(payload);
    const accessToken = await ensureZohoAccessToken();
    const workOrder = await createFsmWorkOrder(accessToken, normalized);

    return NextResponse.json({
      ok: true,
      bookingId: normalized.bookingId ?? null,
      workOrderId: workOrder.id ?? null,
      workOrderNumber: workOrder.number ?? null,
      zohoResponse: workOrder.raw,
    });
  } catch (error) {
    console.error("Failed to process Zoho Bookings webhook", error);
    const message =
      error instanceof Error ? error.message : "Failed to create Zoho FSM work order";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

function extractBearerToken(header: string | null): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }
  return undefined;
}

function normalizeBookingPayload(payload: BookingPayload): NormalizedBooking {
  const bookingId = pickString(
    payload.booking_id,
    payload.bookingId,
    payload.id,
    payload.appointment_id,
    (payload.booking as BookingPayload | undefined)?.id,
    (payload.payload as BookingPayload | undefined)?.booking_id,
  );

  const customer = normalizeCustomer(payload);
  const appointment = normalizeAppointment(payload);
  const notes = pickString(
    payload.notes,
    payload.customer_notes,
    payload.additional_notes,
    (payload.customer as BookingPayload | undefined)?.notes,
  );

  const serviceLineItems = normalizeServiceLineItems(payload, appointment.serviceName);

  return {
    bookingId: bookingId ?? undefined,
    customer,
    appointment: {
      ...appointment,
      notes: appointment.notes ?? notes ?? undefined,
    },
    notes: notes ?? undefined,
    serviceLineItems,
  } satisfies NormalizedBooking;
}

function normalizeCustomer(payload: BookingPayload): WorkOrderCustomerInput {
  const customer = (payload.customer as BookingPayload | undefined) ?? {};

  const name = pickString(
    customer.name,
    customer.full_name,
    customer.display_name,
    payload.customer_name,
    payload.client_name,
  );

  if (!name) {
    throw new Error("Booking payload did not include a customer name.");
  }

  const email = pickString(customer.email, payload.customer_email, payload.client_email);
  const phone = pickString(
    customer.phone,
    customer.phone_number,
    customer.mobile,
    payload.customer_phone,
    payload.client_phone,
  );

  const address = stringifyAddress(
    customer.address ?? payload.customer_address ?? payload.address ?? payload.location,
  );

  const id = pickString(customer.id, customer.customer_id, payload.customer_id);
  const companyName = pickString(customer.company, customer.company_name, payload.company_name);
  const companyId = pickString(customer.company_id, payload.company_id);

  return {
    name,
    email: email ?? undefined,
    phone: phone ?? undefined,
    address: address ?? undefined,
    id: id ?? undefined,
    company: companyName || companyId
      ? {
          name: companyName ?? undefined,
          id: companyId ?? undefined,
        }
      : undefined,
  } satisfies WorkOrderCustomerInput;
}

function normalizeAppointment(payload: BookingPayload): WorkOrderAppointmentInput {
  const appointment = (payload.appointment as BookingPayload | undefined) ?? {};
  const service = (payload.service as BookingPayload | undefined) ?? {};
  const staff = (payload.staff as BookingPayload | undefined) ?? {};

  const start = pickString(
    appointment.start,
    appointment.start_time,
    payload.start_time,
    payload.start,
    payload.appointment_start,
    payload.slot_start,
    (payload.slot as BookingPayload | undefined)?.start_time,
  );

  const end = pickString(
    appointment.end,
    appointment.end_time,
    payload.end_time,
    payload.end,
    payload.appointment_end,
    payload.slot_end,
    (payload.slot as BookingPayload | undefined)?.end_time,
  );

  const serviceName = pickString(
    appointment.service_name,
    service.name,
    service.display_name,
    payload.service_name,
    payload.product_name,
  );

  const staffName = pickString(
    appointment.staff_name,
    staff.name,
    staff.display_name,
    payload.staff_name,
    payload.resource_name,
  );

  const notes = pickString(
    appointment.notes,
    appointment.description,
    payload.description,
    payload.meeting_notes,
  );

  return {
    start: start ?? undefined,
    end: end ?? undefined,
    serviceName: serviceName ?? undefined,
    staffName: staffName ?? undefined,
    notes: notes ?? undefined,
  } satisfies WorkOrderAppointmentInput;
}

function normalizeServiceLineItems(
  payload: BookingPayload,
  fallbackServiceName?: string,
): ServiceLineItemInput[] | undefined {
  const candidateArrays = [
    payload.service_line_items,
    payload.services,
    payload.line_items,
    payload.add_ons,
  ];

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate)) continue;
    const items = candidate
      .map((item) => normalizeServiceLineItem(item as BookingPayload))
      .filter((item): item is ServiceLineItemInput => Boolean(item));

    if (items.length > 0) {
      return items;
    }
  }

  if (fallbackServiceName) {
    return [
      {
        serviceName: fallbackServiceName,
        quantity: 1,
      },
    ];
  }

  return undefined;
}

function normalizeServiceLineItem(item: BookingPayload): ServiceLineItemInput | undefined {
  const serviceName = pickString(item.service_name, item.name, item.display_name);
  const serviceId = pickString(item.service_id, item.id);

  if (!serviceName && !serviceId) {
    return undefined;
  }

  const quantityValue = item.quantity ?? item.qty ?? item.count;
  const quantity = typeof quantityValue === "number" ? quantityValue : Number(quantityValue);
  const description = pickString(item.description, item.notes);

  return {
    serviceName: serviceName ?? undefined,
    serviceId: serviceId ?? undefined,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
    description: description ?? undefined,
  } satisfies ServiceLineItemInput;
}

function stringifyAddress(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => stringifyAddress(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? Array.from(new Set(parts)).join(", ") : undefined;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const parts = entries
      .map(([, entryValue]) => stringifyAddress(entryValue))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? Array.from(new Set(parts)).join(", ") : undefined;
  }

  return undefined;
}

function pickString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}
