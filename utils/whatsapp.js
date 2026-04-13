/**
 * WhatsApp Cloud API (Meta) helper.
 *
 * Required env vars:
 *   WA_ACCESS_TOKEN    – Permanent system-user token from Meta for Developers
 *   WA_PHONE_NUMBER_ID – Phone Number ID from WhatsApp Business dashboard
 *
 * If either var is absent the function silently logs and returns — the garage
 * can still operate normally without WhatsApp integration configured.
 *
 * API reference: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

const https = require("https");

/**
 * Send a plain-text WhatsApp message.
 * @param {string} toPhone  – recipient phone in international format (e.g. "919876543210")
 * @param {string} message  – message body text
 * @returns {Promise<void>}
 */
async function sendWhatsApp(toPhone, message) {
  const token       = process.env.WA_ACCESS_TOKEN;
  const phoneNumId  = process.env.WA_PHONE_NUMBER_ID;

  if (!token || !phoneNumId) {
    console.info("[WhatsApp] Skipped — WA_ACCESS_TOKEN or WA_PHONE_NUMBER_ID not configured.");
    return;
  }

  // Normalise to digits only (strip +, spaces, dashes)
  const recipient = String(toPhone).replace(/\D/g, "");
  if (!recipient || recipient.length < 10) {
    console.warn("[WhatsApp] Invalid recipient phone:", toPhone);
    return;
  }

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: { body: message },
  });

  const options = {
    hostname: "graph.facebook.com",
    path:     `/v19.0/${phoneNumId}/messages`,
    method:   "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.info(`[WhatsApp] Message sent to ${recipient}`);
          resolve();
        } else {
          console.error("[WhatsApp] API error:", res.statusCode, data);
          resolve(); // non-fatal — don't block the RO update
        }
      });
    });
    req.on("error", (err) => {
      console.error("[WhatsApp] Request error:", err.message);
      resolve(); // non-fatal
    });
    req.write(body);
    req.end();
  });
}

module.exports = { sendWhatsApp };
