const { z } = require("zod");
// ─────────────────────────────────────────────────────────────────
//  Schema: Add Vehicle  (POST /api/v1/vehicle/add)
const addVehicleSchema = z.object({
  // Owner-only field — ignored for customers (controller handles this)
  userId: z.string().optional(),

  vehicleBrand: z.string().min(1, "Vehicle brand is required").max(100).trim(),

  vehicleModel: z.string().min(1, "Vehicle model is required").max(100).trim(),

  vehicleRegisterNo: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),

  vehiclePurchaseDate: z
    .string()
    .datetime({
      message:
        "Invalid date format. Use ISO 8601 (e.g. 2023-06-15T00:00:00.000Z)",
    })
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),

  vehicleEngineNo: z.string().trim().optional(),
  vehicleVinNo: z.string().trim().optional(),

  vehicleInsuranceProvider: z.string().trim().optional(),
  vehiclePolicyNo: z.string().trim().optional(),

  vehicleInsuranceExpire: z
    .string()
    .datetime({ message: "Invalid date format. Use ISO 8601" })
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),

  vehicleRegCertificate: z.string().trim().optional(),
  vehicleInsuranceDoc: z.string().trim().optional(),
});

module.exports = { addVehicleSchema };
