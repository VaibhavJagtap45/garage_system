const { z } = require("zod");

// ─── Reusable field definitions ───────────────────────────
const phoneNoField = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

const emailField = z
  .string()
  .email("Invalid email format")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v));

const optionalUrlField = (message = "Must be a valid URL") =>
  z
    .string()
    .url(message)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v));

// ─── Schemas ──────────────────────────────────────────────
const requestOtpSchema = z.object({
  phoneNo: phoneNoField,
});

const otpVerifySchema = z.object({
  phoneNo: phoneNoField,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numeric"),
});

const garageProfileSchema = z
  .object({
    fullName: z.string().min(2, "Min 2 characters").max(50).trim().optional(),
    emailId: emailField,
    garageName: z.string().min(2, "Min 2 characters").trim(),
    garageOwnerName: z.string().min(2, "Min 2 characters").trim(),
    garageAddress: z.string().min(5, "Min 5 characters").trim(),
    garageContactNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid contact number"),
    garageType: z.enum(["twoWheeler", "fourWheeler"], {
      errorMap: () => ({ message: "Must be twoWheeler or fourWheeler" }),
    }),
    garageLogo: optionalUrlField("Garage logo must be a valid URL"),
    state: z.string().trim().optional(),
    isGstApplicable: z.boolean().default(false),
    gstNumber: z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GST number format",
      )
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),
  })
  .refine((data) => !data.isGstApplicable || !!data.gstNumber, {
    message: "GST number is required when GST is applicable",
    path: ["gstNumber"],
  });

module.exports = {
  requestOtpSchema,
  otpVerifySchema,
  garageProfileSchema,
};
