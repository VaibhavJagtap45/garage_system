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
    return res.redirect(302, redirectUrl.toString());
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
