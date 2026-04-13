/**
 * Escape a string so it is safe to embed inside `new RegExp(...)`.
 *
 * Without escaping, user-supplied input like "(a+)+" can cause catastrophic
 * backtracking (ReDoS). One call here makes every search input safe.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = escapeRegex;
