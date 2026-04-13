const Garage = require("../models/Garage.model");

/**
 * Resolve the garageId for any authenticated user:
 *   - owner  → Garage.owner === user._id  (DB lookup)
 *   - member / vendor → user.garage        (stamped on the user document at login)
 *
 * Returns null if no garage is found so callers can return a 404.
 *
 * @param {import("../models/User.model")} user  req.user from auth middleware
 * @returns {Promise<import("mongoose").Types.ObjectId|null>}
 */
async function resolveGarageId(user) {
  if (user.role === "owner") {
    const g = await Garage.findOne({ owner: user._id }).select("_id").lean();
    return g?._id ?? null;
  }
  return user.garage ?? null;
}

module.exports = resolveGarageId;
