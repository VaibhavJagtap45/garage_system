const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking.model");
const Garage = require("../models/Garage.model");
const GoogleCalendarConnection = require("../models/GoogleCalendarConnection.model");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const DEFAULT_APP_REDIRECT_PREFIX = "apnogarage://";
const STATE_AUDIENCE = "google-calendar-oauth";
const STATE_ISSUER = "apnogarage-api";

function oauthConfig() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
  };
}

function isGoogleCalendarConfigured() {
  const cfg = oauthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
}

function requireGoogleCalendarConfig() {
  const cfg = oauthConfig();
  if (!isGoogleCalendarConfigured()) {
    throw new Error(
      "Google Calendar is not configured. Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.",
    );
  }
  return cfg;
}

function stateSecret() {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is required for Google Calendar OAuth state.");
  }
  return process.env.JWT_ACCESS_SECRET;
}

function encryptionKey() {
  const secret =
    process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error(
      "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY or JWT_ACCESS_SECRET is required to protect Google refresh tokens.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
    alg: "aes-256-gcm",
  };
}

function decryptToken(payload) {
  if (!payload?.iv || !payload?.tag || !payload?.data) return null;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function allowedAppRedirects() {
  return (process.env.GOOGLE_CALENDAR_ALLOWED_APP_REDIRECTS || DEFAULT_APP_REDIRECT_PREFIX)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function validateAppRedirectUri(appRedirectUri) {
  if (!appRedirectUri) throw new Error("appRedirectUri is required.");
  const isAllowed = allowedAppRedirects().some((prefix) =>
    appRedirectUri.startsWith(prefix),
  );
  if (!isAllowed) {
    throw new Error("This app redirect URI is not allowed for Google Calendar.");
  }
  return appRedirectUri;
}

function buildState({ ownerId, garageId, appRedirectUri }) {
  return jwt.sign(
    {
      ownerId: String(ownerId),
      garageId: String(garageId),
      appRedirectUri: validateAppRedirectUri(appRedirectUri),
    },
    stateSecret(),
    {
      expiresIn: "10m",
      audience: STATE_AUDIENCE,
      issuer: STATE_ISSUER,
    },
  );
}

function verifyState(state) {
  return jwt.verify(state, stateSecret(), {
    audience: STATE_AUDIENCE,
    issuer: STATE_ISSUER,
  });
}

function buildGoogleCalendarConnectUrl({ ownerId, garageId, appRedirectUri }) {
  const cfg = requireGoogleCalendarConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state: buildState({ ownerId, garageId, appRedirectUri }),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const cfg = requireGoogleCalendarConfig();
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const { data } = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });
  return data;
}

async function refreshAccessToken(refreshToken) {
  const cfg = requireGoogleCalendarConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const { data } = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });
  return data;
}

async function upsertConnection({ ownerId, garageId, tokens }) {
  const existing = await GoogleCalendarConnection.findOne({ owner: ownerId })
    .select("+refreshToken")
    .lean();
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : existing?.refreshToken;

  if (!encryptedRefreshToken) {
    throw new Error(
      "Google did not return a refresh token. Disconnect and connect again to grant offline access.",
    );
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
    : null;

  const connection = await GoogleCalendarConnection.findOneAndUpdate(
    { owner: ownerId },
    {
      owner: ownerId,
      garage: garageId,
      calendarId: oauthConfig().calendarId,
      refreshToken: encryptedRefreshToken,
      scope: tokens.scope || SCOPES.join(" "),
      tokenType: tokens.token_type || "Bearer",
      accessTokenExpiresAt: expiresAt,
      connectedAt: new Date(),
      disconnectedAt: null,
      isActive: true,
      lastError: null,
    },
    { new: true, upsert: true },
  ).lean();

  return connection;
}

async function completeGoogleCalendarOAuth({ code, state, error, error_description }) {
  const decoded = verifyState(state);
  if (error) {
    throw new Error(error_description || error);
  }
  if (!code) throw new Error("Missing Google authorization code.");
  const tokens = await exchangeCodeForTokens(code);
  await upsertConnection({
    ownerId: decoded.ownerId,
    garageId: decoded.garageId,
    tokens,
  });
  return { appRedirectUri: decoded.appRedirectUri };
}

async function getGoogleCalendarStatus(ownerId) {
  const connection = await GoogleCalendarConnection.findOne({ owner: ownerId })
    .select("-refreshToken")
    .lean();
  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(connection?.isActive),
    calendarId: connection?.calendarId || oauthConfig().calendarId || "primary",
    connectedAt: connection?.isActive ? connection.connectedAt : null,
    disconnectedAt: connection?.disconnectedAt || null,
    lastSyncedAt: connection?.isActive ? connection.lastSyncedAt : null,
    lastError: connection?.lastError || null,
  };
}

async function disconnectGoogleCalendar(ownerId) {
  const connection = await GoogleCalendarConnection.findOne({ owner: ownerId })
    .select("+refreshToken")
    .lean();
  if (!connection) return null;

  const refreshToken = decryptToken(connection.refreshToken);
  if (refreshToken) {
    await axios
      .post(
        GOOGLE_REVOKE_URL,
        new URLSearchParams({ token: refreshToken }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000,
        },
      )
      .catch(() => null);
  }

  return GoogleCalendarConnection.findOneAndUpdate(
    { owner: ownerId },
    {
      $set: {
        isActive: false,
        disconnectedAt: new Date(),
        lastError: null,
      },
      $unset: { refreshToken: "" },
    },
    { new: true },
  ).lean();
}

function vehicleText(vehicle) {
  if (!vehicle) return "";
  return [
    [vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(" "),
    vehicle.vehicleRegisterNo ? `(${vehicle.vehicleRegisterNo})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function bookingDescription(booking, garage) {
  const customer = booking.customer || {};
  const lines = [
    `Booking No: ${booking.bookingNo || ""}`,
    `Customer: ${customer.fullName || ""}`,
    customer.phoneNo ? `Phone: ${customer.phoneNo}` : "",
    customer.emailId ? `Email: ${customer.emailId}` : "",
    booking.serviceType ? `Service: ${booking.serviceType}` : "",
    booking.vehicle ? `Vehicle: ${vehicleText(booking.vehicle)}` : "",
    garage?.garageName ? `Garage: ${garage.garageName}` : "",
    booking.notes ? `Notes: ${booking.notes}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function eventPayload(booking, garage) {
  const start = new Date(booking.scheduledAt);
  const durationMinutes = Math.max(Number(booking.duration) || 60, 15);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const customer = booking.customer || {};
  const summaryParts = [
    "Garage Appointment",
    booking.serviceType || "Service",
    customer.fullName || "",
  ].filter(Boolean);

  return {
    summary: summaryParts.join(" - "),
    location: garage?.garageAddress || "",
    description: bookingDescription(booking, garage),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        apnoGarageBookingId: String(booking._id),
        apnoGarageBookingNo: booking.bookingNo || "",
      },
    },
  };
}

function calendarEventBaseUrl(calendarId) {
  return `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    calendarId || "primary",
  )}/events`;
}

async function loadBookingForCalendar(bookingOrId) {
  if (typeof bookingOrId === "object" && bookingOrId.customer?.fullName !== undefined) {
    return bookingOrId;
  }
  const id = typeof bookingOrId === "object" ? bookingOrId._id : bookingOrId;
  return Booking.findById(id)
    .populate("customer", "fullName phoneNo emailId")
    .populate("vehicle", "vehicleBrand vehicleModel vehicleRegisterNo")
    .lean();
}

async function calendarFailure(bookingId, syncStatus, message, ownerId = null) {
  const googleCalendar = {
    syncStatus,
    lastError: message,
    syncedAt: null,
  };
  await Booking.findByIdAndUpdate(bookingId, {
    $set: {
      "googleCalendar.syncStatus": syncStatus,
      "googleCalendar.lastError": message,
      "googleCalendar.syncedAt": null,
    },
  });
  if (ownerId) {
    await GoogleCalendarConnection.findOneAndUpdate(
      { owner: ownerId },
      { lastError: message },
    );
  }
  return { ok: false, googleCalendar, message, syncStatus };
}

function googleErrorMessage(error) {
  return (
    error?.response?.data?.error_description ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error.message ||
    "Google Calendar sync failed."
  );
}

async function activeConnection(ownerId) {
  return GoogleCalendarConnection.findOne({ owner: ownerId, isActive: true })
    .select("+refreshToken")
    .lean();
}

async function syncBookingToOwnerCalendar(bookingOrId, options = {}) {
  const booking = await loadBookingForCalendar(bookingOrId);
  if (!booking) return { ok: false, message: "Booking not found." };

  if (!isGoogleCalendarConfigured()) {
    return calendarFailure(
      booking._id,
      "not_configured",
      "Google Calendar backend is not configured.",
    );
  }

  const garage =
    options.garage || (await Garage.findById(booking.garage).lean());
  if (!garage?.owner) {
    return calendarFailure(booking._id, "failed", "Garage owner not found.");
  }

  const connection = await activeConnection(garage.owner);
  if (!connection) {
    return calendarFailure(
      booking._id,
      "not_connected",
      "Google Calendar is not connected for this owner.",
      garage.owner,
    );
  }

  try {
    const refreshToken = decryptToken(connection.refreshToken);
    const token = await refreshAccessToken(refreshToken);
    const accessToken = token.access_token;
    const payload = eventPayload(booking, garage);
    const baseUrl = calendarEventBaseUrl(connection.calendarId);
    let data;

    if (booking.googleCalendar?.eventId) {
      try {
        const res = await axios.patch(
          `${baseUrl}/${encodeURIComponent(booking.googleCalendar.eventId)}`,
          payload,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { sendUpdates: "none" },
            timeout: 15000,
          },
        );
        data = res.data;
      } catch (error) {
        if (error?.response?.status !== 404) throw error;
      }
    }

    if (!data) {
      const res = await axios.post(baseUrl, payload, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { sendUpdates: "none" },
        timeout: 15000,
      });
      data = res.data;
    }

    const googleCalendar = {
      syncStatus: "synced",
      eventId: data.id,
      htmlLink: data.htmlLink,
      syncedAt: new Date(),
      lastError: null,
    };

    await Promise.all([
      Booking.findByIdAndUpdate(booking._id, { $set: { googleCalendar } }),
      GoogleCalendarConnection.findOneAndUpdate(
        { owner: garage.owner },
        { lastSyncedAt: new Date(), lastError: null },
      ),
    ]);

    return { ok: true, googleCalendar, event: data };
  } catch (error) {
    const message = googleErrorMessage(error);
    if (error?.response?.data?.error === "invalid_grant") {
      await GoogleCalendarConnection.findOneAndUpdate(
        { owner: garage.owner },
        { isActive: false, disconnectedAt: new Date(), lastError: message },
      );
    }
    return calendarFailure(booking._id, "failed", message, garage.owner);
  }
}

async function removeBookingFromOwnerCalendar(bookingOrId, options = {}) {
  const booking = await loadBookingForCalendar(bookingOrId);
  const eventId = booking?.googleCalendar?.eventId;
  if (!booking || !eventId || !isGoogleCalendarConfigured()) {
    return { ok: true, skipped: true };
  }

  const garage =
    options.garage || (await Garage.findById(booking.garage).lean());
  if (!garage?.owner) return { ok: true, skipped: true };

  const connection = await activeConnection(garage.owner);
  if (!connection) return { ok: true, skipped: true };

  try {
    const refreshToken = decryptToken(connection.refreshToken);
    const token = await refreshAccessToken(refreshToken);
    const baseUrl = calendarEventBaseUrl(connection.calendarId);
    await axios.delete(`${baseUrl}/${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      params: { sendUpdates: "none" },
      timeout: 15000,
    });
  } catch (error) {
    if (error?.response?.status !== 404) {
      const message = googleErrorMessage(error);
      return calendarFailure(booking._id, "failed", message, garage.owner);
    }
  }

  const googleCalendar = {
    syncStatus: "deleted",
    eventId: null,
    htmlLink: null,
    syncedAt: new Date(),
    lastError: null,
  };
  await Booking.findByIdAndUpdate(booking._id, { $set: { googleCalendar } });
  return { ok: true, googleCalendar };
}

module.exports = {
  SCOPES,
  buildGoogleCalendarConnectUrl,
  completeGoogleCalendarOAuth,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  removeBookingFromOwnerCalendar,
  syncBookingToOwnerCalendar,
  validateAppRedirectUri,
};
