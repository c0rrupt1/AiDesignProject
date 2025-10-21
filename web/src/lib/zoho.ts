import "server-only";

export interface WorkOrderCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  id?: string;
  company?: {
    id?: string;
    name?: string;
  };
}

export interface WorkOrderAppointmentInput {
  start?: string;
  end?: string;
  serviceName?: string;
  staffName?: string;
  summary?: string;
  notes?: string;
}

export interface ServiceLineItemInput {
  serviceId?: string;
  serviceName?: string;
  quantity?: number;
  description?: string;
}

export interface CreateWorkOrderInput {
  bookingId?: string;
  customer: WorkOrderCustomerInput;
  appointment: WorkOrderAppointmentInput;
  notes?: string;
  serviceLineItems?: ServiceLineItemInput[];
  additionalFields?: Record<string, unknown>;
}

export interface CreateWorkOrderResult {
  id?: string;
  number?: string;
  raw: unknown;
}

let inMemoryAccessToken: string | null = null;
let inMemoryExpiry = 0;

export async function ensureZohoAccessToken(): Promise<string> {
  if (inMemoryAccessToken && Date.now() < inMemoryExpiry) {
    return inMemoryAccessToken;
  }

  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!accountsUrl || !refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoho OAuth configuration. Ensure ZOHO_ACCOUNTS_URL, ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, and ZOHO_CLIENT_SECRET are set.",
    );
  }

  const url = new URL("/oauth/v2/token", accountsUrl);
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to refresh Zoho OAuth token (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("Zoho OAuth response did not include an access token.");
  }

  const expiresInSeconds = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  inMemoryAccessToken = payload.access_token;
  inMemoryExpiry = Date.now() + Math.max(expiresInSeconds - 30, 30) * 1000;

  return inMemoryAccessToken;
}

export async function createFsmWorkOrder(
  accessToken: string,
  input: CreateWorkOrderInput,
): Promise<CreateWorkOrderResult> {
  const apiBase = process.env.ZOHO_FSM_API_BASE;
  if (!apiBase) {
    throw new Error("ZOHO_FSM_API_BASE environment variable is not configured.");
  }

  if (!input.customer?.name) {
    throw new Error("Cannot create a work order without a customer name.");
  }

  const url = new URL("/fsm/v1/workorders", apiBase);

  const contactBlock = compactObject({
    Id: input.customer.id,
    Name: input.customer.name,
    Email: input.customer.email,
    Phone: input.customer.phone,
    Address: input.customer.address,
  });

  const companyBlock = input.customer.company
    ? compactObject({
        Id: input.customer.company.id,
        Name: input.customer.company.name,
      })
    : undefined;

  const descriptionParts: string[] = [];
  if (input.notes) descriptionParts.push(input.notes);
  if (input.appointment.notes && input.appointment.notes !== input.notes) {
    descriptionParts.push(input.appointment.notes);
  }
  if (input.appointment.staffName) {
    descriptionParts.push(`Requested staff: ${input.appointment.staffName}`);
  }
  if (input.customer.address) {
    descriptionParts.push(`Service address: ${input.customer.address}`);
  }

  const description = descriptionParts.join("\n\n").trim() || undefined;

  const serviceLineItems = input.serviceLineItems
    ?.map((item) =>
      compactObject({
        Service_Id: item.serviceId,
        Service_Name: item.serviceName,
        Quantity:
          typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? item.quantity
            : 1,
        Description: item.description,
      }),
    )
    .filter((item) => Object.keys(item).length > 0);

  const dataEntry = compactObject({
    Summary:
      input.appointment.summary ??
      (input.appointment.serviceName && input.customer.name
        ? `${input.appointment.serviceName} for ${input.customer.name}`
        : input.bookingId
          ? `Booking ${input.bookingId}`
          : "Service appointment"),
    Description: description,
    Scheduled_Start_Time: input.appointment.start,
    Scheduled_End_Time: input.appointment.end,
    Contact: Object.keys(contactBlock).length > 0 ? contactBlock : undefined,
    Company: companyBlock && Object.keys(companyBlock).length > 0 ? companyBlock : undefined,
    Service_Line_Items: serviceLineItems && serviceLineItems.length > 0 ? serviceLineItems : undefined,
    External_Id: input.bookingId,
    ...input.additionalFields,
  });

  const payload = {
    data: [dataEntry],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawText = await response.text();
  let responseBody: unknown = undefined;
  if (rawText) {
    try {
      responseBody = JSON.parse(rawText);
    } catch {
      responseBody = rawText;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Zoho FSM create work order failed (${response.status} ${response.statusText}): ${rawText || "Unknown error"}`,
    );
  }

  const firstItem =
    responseBody && typeof responseBody === "object" && "data" in responseBody
      ? Array.isArray((responseBody as { data?: unknown[] }).data)
        ? (responseBody as { data?: unknown[] }).data?.[0]
        : undefined
      : undefined;

  const details =
    firstItem && typeof firstItem === "object" && firstItem !== null && "details" in firstItem
      ? (firstItem as { details?: Record<string, unknown> }).details
      : (firstItem as Record<string, unknown> | undefined);

  const id = pickDetail(details, ["id", "ID", "work_order_id", "Work_Order_Id"]);
  const number = pickDetail(details, ["work_order_number", "Work_Order_Number", "display_value"]);

  return {
    id: id ?? undefined,
    number: number ?? undefined,
    raw: responseBody,
  };
}

function pickDetail(
  details: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!details) return undefined;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function compactObject<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
  );
}
