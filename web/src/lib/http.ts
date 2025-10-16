export class HttpError extends Error {
  status: number;
  statusText: string;
  body: unknown;
  rawText: string;

  constructor({
    status,
    statusText,
    message,
    body,
    rawText,
  }: {
    status: number;
    statusText: string;
    message: string;
    body: unknown;
    rawText: string;
  }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.rawText = rawText;
  }
}

type FetchJsonOptions = RequestInit & {
  signal?: AbortSignal;
  parse?: (payload: unknown) => unknown;
  errorMessage?: string;
};

export async function fetchJson<T>(
  input: RequestInfo | URL,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { parse, errorMessage, ...rest } = options;

  const response = await fetch(input, rest);
  const rawText = await response.text();
  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const fallbackMessage =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : undefined) ??
      (rawText ? rawText.slice(0, 200) : response.statusText) ??
      "Request failed.";

    throw new HttpError({
      status: response.status,
      statusText: response.statusText,
      message: errorMessage ?? fallbackMessage,
      body: payload,
      rawText,
    });
  }

  const value = parse ? parse(payload) : payload;
  if (value === null || value === undefined) {
    throw new Error("Expected a JSON response body but received none.");
  }

  return value as T;
}
