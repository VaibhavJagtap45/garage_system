const { z } = require("zod");

// ─── Reusable field definitions ───────────────────────────────────

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

// ─── Schema: Request OTP ──────────────────────────────────────────
const requestOtpSchema = z.object({
  phoneNo: phoneNoField,
});

// ─── Schema: Verify OTP ───────────────────────────────────────────
const otpVerifySchema = z.object({
  phoneNo: phoneNoField,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numeric"),
});

// ─── Schema: Complete Garage Profile ─────────────────────────────
//
//  This schema mirrors the form that the frontend sends.
//  It validates both user-level fields (fullName, emailId, state)
//  and garage-level fields together in one pass — Zod strips/coerces
//  the values before they reach the controller which then splits them
//  into the appropriate documents.
//
//  isGstApplicable can arrive as a boolean (JSON) or the strings
//  "true"/"false" (FormData) — both are handled via the preprocess.
// ─────────────────────────────────────────────────────────────────
const garageProfileSchema = z
  .object({
    // ── User-level fields ──────────────────────────────────────
    fullName: z.string().min(2, "Min 2 characters").max(50).trim().optional(),
    emailId: emailField,
    state: z.string().trim().optional(),

    // ── Garage-level fields ────────────────────────────────────
    garageName: z.string().min(2, "Min 2 characters").max(100).trim(),
    garageOwnerName: z.string().min(2, "Min 2 characters").max(100).trim(),
    garageAddress: z.string().min(5, "Min 5 characters").max(300).trim(),
    garageContactNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid contact number"),
    garageType: z.enum(["twoWheeler", "fourWheeler"], {
      errorMap: () => ({ message: "Must be twoWheeler or fourWheeler" }),
    }),
    garageLogo: optionalUrlField("Garage logo must be a valid URL"),

    // ── GST — coerce FormData strings to boolean ───────────────
    isGstApplicable: z.preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (v === "true") return true;
      if (v === "false") return false;
      return false;
    }, z.boolean().default(false)),
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

// ─── Schema: Add User  (POST /api/user/add-user) ─────────────────
//
//  · role is supplied by the frontend — restricted to non-owner values
//  · At least one of phoneNo or emailId must be present
//  · fullName is optional
// ─────────────────────────────────────────────────────────────────
const addUserSchema = z
  .object({
    phoneNo: phoneNoField.optional(),
    emailId: z
      .string()
      .email("Invalid email format")
      .toLowerCase()
      .trim()
      .optional(),
    fullName: z.string().min(2, "Min 2 characters").max(100).trim().optional(),
    role: z.enum(["customer", "member", "vendor"], {
      errorMap: () => ({
        message: "Role must be one of: customer, member, vendor",
      }),
    }),
  })
  .refine((data) => data.phoneNo || data.emailId, {
    message: "At least one of phoneNo or emailId is required",
    path: ["phoneNo"],
  });

module.exports = {
  requestOtpSchema,
  otpVerifySchema,
  garageProfileSchema,
  addUserSchema,
};
