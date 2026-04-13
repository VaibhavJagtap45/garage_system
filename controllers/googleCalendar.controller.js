const Garage = require("../models/Garage.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response.utils");
const {
  buildGoogleCalendarConnectUrl,
  completeGoogleCalendarOAuth,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} = require("../services/googleCalendar.service");

async function ownerGarage(userId) {
  return Garage.findOne({ owner: userId }).lean();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function browserMessage(res, title, message) {
  return res
    .status(200)
    .type("html")
    .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; line-height: 1.5; color: #111827; }
      .box { max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`);
}

const getStatus = asyncHandler(async (req, res) => {
  const status = await getGoogleCalendarStatus(req.user._id);
  return sendSuccess(res, 200, "Google Calendar status fetched.", {
    integration: status,
  });
});

const getConnectUrl = asyncHandler(async (req, res) => {
  const garage = await ownerGarage(req.user._id);
  if (!garage) {
    return sendError(
      res,
      400,
      "Garage profile not found. Please complete your garage setup first.",
    );
  }

  const authUrl = buildGoogleCalendarConnectUrl({
    ownerId: req.user._id,
    garageId: garage._id,
    appRedirectUri: req.query.appRedirectUri,
  });

  return sendSuccess(res, 200, "Google Calendar connect URL created.", {
    authUrl,
  });
});

const disconnect = asyncHandler(async (req, res) => {
  await disconnectGoogleCalendar(req.user._id);
  return sendSuccess(res, 200, "Google Calendar disconnected.", {
    integration: await getGoogleCalendarStatus(req.user._id),
  });
});

const oauthCallback = async (req, res) => {
  try {
    const result = await completeGoogleCalendarOAuth(req.query);
    const redirectUrl = new URL(result.appRedirectUri);
    redirectUrl.searchParams.set("googleCalendar", "connected");
    const deepLink = escapeHtml(redirectUrl.toString());
    return res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Google Calendar Connected</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
      .card{background:#fff;border-radius:16px;padding:32px 24px;text-align:center;max-width:360px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08)}
      .icon{font-size:48px;margin-bottom:16px}
      h2{color:#1D9E75;font-size:20px;margin-bottom:8px}
      p{color:#6B7280;font-size:14px;line-height:1.6;margin-bottom:24px}
      a{display:inline-block;padding:14px 28px;background:#1D9E75;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:15px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✅</div>
      <h2>Google Calendar Connected!</h2>
      <p>Your garage bookings will now sync automatically to your Google Calendar.</p>
      <a href="${deepLink}">Return to App</a>
    </div>
    <script>
      // Auto-return to app — works if OS handles the custom scheme
      setTimeout(function(){ window.location.replace("${deepLink}"); }, 600);
    </script>
  </body>
</html>`);
  } catch (error) {
    return browserMessage(
      res,
      "Google Calendar connection failed",
      error.message || "Please close this window and try connecting again.",
    );
  }
};

module.exports = {
  disconnect,
  getConnectUrl,
  getStatus,
  oauthCallback,
};
