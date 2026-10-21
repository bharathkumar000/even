// src/lib/viceverse-portal.ts
// Server‑only helper to call the ViceVerse portal Google Apps Script endpoint.

import "server-only";

/**
 * Result shape returned by the Apps Script `apiSavePortalAccount` function.
 */
export interface PortalAccountResult {
  status: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Calls the Apps Script Web‑App to create (or update) a portal account.
 *
 * The request includes the `API_SECRET` as an `apiKey` query parameter – the
 * Apps Script validates this secret before processing the payload.
 *
 * The function automatically follows safe redirects (307/308) preserving the
 * POST method and body. It throws on network errors, missing environment
 * variables, or non‑2xx responses.
 */
export async function createPortalAccount(
  teamIdOrQuery: string,
  loginEmail: string,
): Promise<PortalAccountResult> {
  const baseUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.API_SECRET;

  if (!baseUrl) {
    throw new Error("Missing env var: APPS_SCRIPT_URL");
  }
  if (!secret) {
    throw new Error("Missing env var: API_SECRET");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("apiKey", secret);

  const payload = {
    action: "savePortalAccount",
    teamIdOrQuery,
    loginEmail,
  };

  const maxRedirects = 5;
  let currentUrl = url.toString();
  const body = JSON.stringify(payload);

  for (let i = 0; i <= maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      redirect: "manual", // handle redirects ourselves
    });

    // Preserve POST on 307 / 308 redirects
    if (response.status === 307 || response.status === 308) {
      const location = response.headers.get("Location");
      if (!location) break;
      currentUrl = location;
      // continue loop – same body, same method
      continue;
    }

    // For other 3xx responses (301/302/303) the browser would switch to GET;
    // those are unexpected for our endpoint, so treat them as errors.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location") ?? "(no location)";
      throw new Error(`Unexpected redirect (${response.status}) to ${location}`);
    }

    // Final response – attempt to parse JSON
    const contentType = response.headers.get("content-type") ?? "";
    let result: any;
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch {
        result = { status: "ERROR", message: `Invalid response format: ${text}` };
      }
    }

    if (!response.ok) {
      const msg = result?.message ?? `HTTP ${response.status}`;
      throw new Error(`Apps Script request failed: ${msg}`);
    }

    return result as PortalAccountResult;
  }

  throw new Error("Too many redirects while calling Apps Script endpoint");
}
