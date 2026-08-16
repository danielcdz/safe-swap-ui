/**
 * Nickname rules, shared by the client and the server.
 *
 * Deliberately framework-free so a route handler and a React component can
 * both import it. The client validates for fast feedback; the server validates
 * because the client's opinion is not binding.
 */

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

/**
 * Unicode letter and number classes, not ASCII ranges — this market writes
 * names like José and Andrés, and rejecting them would be a bug, not a rule.
 * A leading separator is still disallowed.
 */
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

/** Returns an error message, or undefined when the value is acceptable. */
export function validateNickname(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < NICKNAME_MIN) return `At least ${NICKNAME_MIN} characters.`;
  if (trimmed.length > NICKNAME_MAX) return `At most ${NICKNAME_MAX} characters.`;
  if (!NICKNAME_PATTERN.test(trimmed)) {
    return "Letters and numbers, plus spaces . _ - after the first character.";
  }
  return undefined;
}

/**
 * A readable placeholder built from the tail of the address, e.g. `Trader-4W37`.
 * Satisfies both the database CHECK and `validateNickname()`.
 */
export function defaultNickname(address: string) {
  return `Trader-${address.slice(-4)}`;
}
