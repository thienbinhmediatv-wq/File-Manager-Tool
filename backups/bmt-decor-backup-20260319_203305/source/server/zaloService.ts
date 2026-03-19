const VERSION4_API = process.env.VERSION4_API || "";
const ZALO_REFRESH_TOKEN = process.env.ZALO_REFRESH_TOKEN || "";
const ZALO_APP_ID = process.env.ZALO_APP_ID || "";
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET || "";

let cachedToken = VERSION4_API;
// If VERSION4_API is pre-configured, assume it was issued "now – 30 min" so we
// treat it as valid for the next ~25 min before attempting a refresh. If no
// static token is set, tokenIssuedAt stays at 0 forcing an immediate refresh on
// first use (provided refresh credentials are available).
let tokenIssuedAt = VERSION4_API ? Date.now() - 30 * 60 * 1000 : 0;

async function refreshZaloToken(): Promise<void> {
  if (!ZALO_REFRESH_TOKEN || !ZALO_APP_ID || !ZALO_APP_SECRET) {
    throw new Error("Zalo refresh credentials not configured (ZALO_REFRESH_TOKEN, ZALO_APP_ID, ZALO_APP_SECRET)");
  }
  const resp = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "secret_key": ZALO_APP_SECRET,
    },
    body: new URLSearchParams({
      refresh_token: ZALO_REFRESH_TOKEN,
      app_id: ZALO_APP_ID,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Zalo token refresh failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as { access_token?: string; error?: number; message?: string };
  if (!data.access_token) {
    throw new Error(`Zalo token refresh error: ${data.message || JSON.stringify(data)}`);
  }
  cachedToken = data.access_token;
  tokenIssuedAt = Date.now();
  console.log("[ZaloService] Token refreshed successfully");
}

async function getValidToken(): Promise<string> {
  const ageMs = Date.now() - tokenIssuedAt;
  const fiftyFiveMinutes = 55 * 60 * 1000;
  const hasRefreshCredentials = Boolean(ZALO_REFRESH_TOKEN && ZALO_APP_ID && ZALO_APP_SECRET);
  if (hasRefreshCredentials && (!cachedToken || ageMs >= fiftyFiveMinutes)) {
    await refreshZaloToken();
  }
  if (!cachedToken) {
    throw new Error("No Zalo access token available. Set VERSION4_API or configure refresh credentials.");
  }
  return cachedToken;
}

async function sendWithRetry(token: string, phone: string, pdfUrl: string): Promise<void> {
  const lookupResp = await fetch(
    `https://openapi.zalo.me/v2.0/oa/getprofile?data=${encodeURIComponent(JSON.stringify({ user_id: phone }))}`,
    { headers: { access_token: token } }
  );
  let userId = phone;
  if (lookupResp.ok) {
    const lookupData = await lookupResp.json() as { data?: { user_id?: string } };
    if (lookupData?.data?.user_id) {
      userId = lookupData.data.user_id;
    }
  }

  const msgPayload = {
    recipient: { user_id: userId },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "media",
          elements: [{ media_type: "file", url: pdfUrl }],
        },
      },
    },
  };

  const sendResp = await fetch("https://openapi.zalo.me/v2.0/oa/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: token,
    },
    body: JSON.stringify(msgPayload),
  });

  const sendData = await sendResp.json() as { error?: number; message?: string };
  if (sendResp.status === 401) {
    throw Object.assign(new Error(`Zalo 401 unauthorized`), { isAuthError: true });
  }
  if (!sendResp.ok || (sendData.error && sendData.error !== 0)) {
    throw new Error(`Zalo send failed (${sendResp.status}): ${sendData.message || JSON.stringify(sendData)}`);
  }

  console.log(`[ZaloService] Message sent to ${phone} (userId=${userId})`);
}

export async function sendFileViaZalo(phone: string, pdfUrl: string): Promise<void> {
  if (!VERSION4_API && !ZALO_REFRESH_TOKEN) {
    throw new Error("Zalo OA not configured: VERSION4_API or ZALO_REFRESH_TOKEN required");
  }

  const token = await getValidToken();

  try {
    await sendWithRetry(token, phone, pdfUrl);
  } catch (err: unknown) {
    if ((err as { isAuthError?: boolean }).isAuthError && ZALO_REFRESH_TOKEN) {
      console.log("[ZaloService] Got 401, forcing token refresh and retrying once...");
      tokenIssuedAt = 0;
      const freshToken = await getValidToken();
      await sendWithRetry(freshToken, phone, pdfUrl);
    } else {
      throw err;
    }
  }
}
