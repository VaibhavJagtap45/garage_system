// ─── services/pushNotification.service.js ────────────────────────────────────
//  Sends push notifications via the Expo Push API.
//  Uses axios (already in package.json) — no extra SDK needed.
//
//  Key production behaviours:
//   • Batches messages (Expo limit: 100 per request)
//   • Auto-clears stale tokens (DeviceNotRegistered) from MongoDB
//   • All sends are fire-and-forget from controllers — never blocks responses
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");
const User  = require("../models/User.model");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 100; // Expo's per-request limit

// ── Notification templates ────────────────────────────────────────────────────
//  Each function returns a ready-to-send payload object.
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATES = {
  // Customer receives when owner creates a booking for them
  BOOKING_CONFIRMED: (bookingNo) => ({
    title: "Booking Confirmed 🎉",
    body:  `Your booking ${bookingNo} has been confirmed. We'll see you soon!`,
    data:  { type: "BOOKING_CONFIRMED", bookingNo },
  }),

  // Customer receives when a new repair order is opened for them
  REPAIR_ORDER_CREATED: (orderNo) => ({
    title: "Repair Order Created 🔧",
    body:  `Your repair order ${orderNo} is open. We'll start work soon.`,
    data:  { type: "REPAIR_ORDER_CREATED", orderNo },
  }),

  // Customer receives when status → in_progress
  REPAIR_STARTED: (orderNo) => ({
    title: "Work Started 🔨",
    body:  `We've started working on your vehicle (Order: ${orderNo}).`,
    data:  { type: "REPAIR_STARTED", orderNo },
  }),

  // Customer receives when status → vehicle_ready
  VEHICLE_READY: (orderNo, garageName) => ({
    title: "Vehicle Ready! 🚗",
    body:  `Your vehicle is ready for pickup at ${garageName}. (${orderNo})`,
    data:  { type: "VEHICLE_READY", orderNo },
  }),

  // Customer receives when status → completed
  REPAIR_COMPLETED: (orderNo) => ({
    title: "Repair Completed ✅",
    body:  `Your repair order ${orderNo} is complete. Thank you for choosing us!`,
    data:  { type: "REPAIR_COMPLETED", orderNo },
  }),
};

// ── Internal: send a batch of pre-built Expo messages ────────────────────────
async function _dispatch(messages) {
  if (!messages.length) return;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    try {
      const { data: body } = await axios.post(EXPO_PUSH_URL, batch, {
        headers: {
          "Content-Type":  "application/json",
          "Accept":        "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 10_000,
      });

      // ── Handle receipt-level errors ────────────────────────────────────────
      const receipts   = body?.data ?? [];
      const staleTokens = [];

      receipts.forEach((receipt, idx) => {
        if (receipt.status !== "error") return;

        console.warn(
          `[Push] Delivery error for ${batch[idx]?.to}:`,
          receipt.message,
          receipt.details?.error,
        );

        // Auto-remove tokens that Expo reports as unregistered
        if (receipt.details?.error === "DeviceNotRegistered") {
          staleTokens.push(batch[idx]?.to);
        }
      });

      if (staleTokens.length) {
        // Fire-and-forget — DB cleanup must not block caller
        User.updateMany(
          { pushToken: { $in: staleTokens } },
          { $set: { pushToken: null } },
        ).catch((err) =>
          console.error("[Push] Stale token cleanup failed:", err.message),
        );
      }
    } catch (err) {
      // Network / Expo outage — log and continue; never crash the caller
      console.error("[Push] Batch dispatch failed:", err.message);
    }
  }
}

// ── notifyUser ────────────────────────────────────────────────────────────────
//  Send a notification to a single user identified by their MongoDB _id.
//  Silently no-ops if the user has no token (never throws).
// ─────────────────────────────────────────────────────────────────────────────
async function notifyUser(userId, template) {
  if (!userId || !template) return;
  return notifyUsers([userId], template);
}

// ── notifyUsers ───────────────────────────────────────────────────────────────
//  Send the same notification to multiple user IDs.
//  Looks up their pushTokens in one DB query, then batches the send.
// ─────────────────────────────────────────────────────────────────────────────
async function notifyUsers(userIds, template) {
  if (!userIds?.length || !template) return;

  const validIds = userIds.filter(Boolean);
  if (!validIds.length) return;

  // Single query — only fetch users that actually have a token
  const users = await User.find(
    {
      _id: { $in: validIds },
      pushToken: { $ne: null, $exists: true },
    },
    { pushToken: 1 },
  ).lean();

  if (!users.length) return;

  const messages = users.map(({ pushToken }) => ({
    to:        pushToken,
    sound:     "default",
    title:     template.title,
    body:      template.body,
    data:      template.data ?? {},
    priority:  "high",
    channelId: "default", // Android notification channel
    badge:     1,
  }));

  await _dispatch(messages);
}

module.exports = { notifyUser, notifyUsers, TEMPLATES };
