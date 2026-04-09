const axios = require("axios");

const FAST2SMS_URL = process.env.FAST2SMS_URL;

/**
 * Send a plain-text SMS via Fast2SMS.
 *
 * NOTE: In India, promotional / reminder messages must use a DLT-registered
 * template and route: "dlt". When you register your template on Fast2SMS /
 * TRAI DLT portal, replace route: "q" with route: "dlt" and add
 * template_id: "<your_template_id>" to the params below.
 *
 * Dev mode: skips the API call and logs to console instead.
 *
 * @param {string} phoneNo  10-digit mobile number
 * @param {string} message  SMS text
 */
const sendSms = async (phoneNo, message) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) throw new Error("FAST2SMS_API_KEY is not configured");
  if (!FAST2SMS_URL) throw new Error("FAST2SMS_URL is not configured");

  // Dev mode — skip API call, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV SMS] To: ${phoneNo} | Message: ${message}`);
    return { return: true, message: "Dev mode — SMS logged to console" };
  }

  try {
    const response = await axios.get(FAST2SMS_URL, {
      params: {
        authorization: apiKey,
        message,
        language: "english",
        route: "q",   // change to "dlt" + add template_id when DLT template is approved
        numbers: phoneNo,
      },
      headers: { "cache-control": "no-cache" },
      timeout: 10000,
    });

    if (response.data.return !== true) {
      throw new Error(
        Array.isArray(response.data.message)
          ? response.data.message[0]
          : response.data.message || "Fast2SMS rejected the request",
      );
    }

    return response.data;
  } catch (err) {
    if (err.response) {
      const data = err.response.data;
      const msg = Array.isArray(data?.message)
        ? data.message[0]
        : typeof data?.message === "string"
          ? data.message
          : "Fast2SMS error";
      throw new Error(`Fast2SMS (${err.response.status}): ${msg}`);
    }
    throw err;
  }
};

module.exports = { sendSms };
