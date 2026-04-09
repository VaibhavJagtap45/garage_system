const axios = require("axios");
const crypto = require("crypto");

const OTP_EXPIRY_MINUTES = 5;
const FAST2SMS_URL = process.env.FAST2SMS_URL;

const generateOTP = () => {
  // Demo mode — always return fixed OTP so testers can log in with 123456
  if (process.env.DEMO_MODE === "true") return "123456";
  return crypto.randomInt(100000, 999999).toString();
};
const hashOTP = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const sendOTP = async (phoneNo, otp) => {
  // Demo mode — skip SMS entirely, OTP is always 123456
  if (process.env.DEMO_MODE === "true") {
    console.log(`[DEMO] OTP for ${phoneNo}: ${otp}`);
    return { return: true, message: "Demo mode — SMS skipped, use 123456" };
  }

  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) throw new Error("FAST2SMS_API_KEY is not configured");
  if (!FAST2SMS_URL) throw new Error("FAST2SMS_URL is not configured");

  // Dev mode — skip SMS, log OTP to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${phoneNo}: ${otp}`);
    return { return: true, message: "Dev mode — OTP logged to console" };
  }

  try {
    const response = await axios.get(FAST2SMS_URL, {
      params: {
        authorization: apiKey,
        message: `Your Garage System OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
        language: "english",
        route: "q",
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

module.exports = { generateOTP, hashOTP, OTP_EXPIRY_MINUTES, sendOTP };
