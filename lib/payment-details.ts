/**
 * Payment detail rules, shared by the client and the server.
 *
 * These mirror the CHECK constraints on `traders` exactly. The client
 * validates for fast feedback; the server validates because the client's
 * opinion is not binding, and without it a bad value reaches the database and
 * comes back as a constraint violation no user should have to read.
 */

export interface PaymentDetailsInput {
  sinpePhone?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
}

/** Matches the `sinpe_phone` constraint. */
const SINPE_PATTERN = /^[0-9+ -]{8,20}$/;

export type PaymentDetailsErrors = Partial<
  Record<"sinpePhone" | "bankName" | "bankAccount" | "form", string>
>;

/**
 * Returns a message per bad field, or an empty object.
 *
 * Every field is optional — a trader who only sells USDC never receives fiat
 * and needs none of this. But a bank name without an account number, or the
 * reverse, is useless to whoever has to send money, so the pair is all or
 * nothing.
 */
export function validatePaymentDetails(
  input: PaymentDetailsInput,
): PaymentDetailsErrors {
  const errors: PaymentDetailsErrors = {};

  const sinpe = input.sinpePhone?.trim() ?? "";
  if (sinpe && !SINPE_PATTERN.test(sinpe)) {
    errors.sinpePhone = "Digits, spaces, + and - only, 8–20 characters.";
  }

  const bankName = input.bankName?.trim() ?? "";
  const bankAccount = input.bankAccount?.trim() ?? "";

  if (bankName && (bankName.length < 2 || bankName.length > 60)) {
    errors.bankName = "Between 2 and 60 characters.";
  }
  if (bankAccount && (bankAccount.length < 4 || bankAccount.length > 40)) {
    errors.bankAccount = "Between 4 and 40 characters.";
  }
  if (bankName && !bankAccount) {
    errors.bankAccount = "Add the account number too, or clear the bank.";
  }
  if (bankAccount && !bankName) {
    errors.bankName = "Add the bank name too, or clear the account.";
  }

  return errors;
}

/** Trims, and turns blanks into null so the column clears rather than storing "". */
export function normalisePaymentDetails(input: PaymentDetailsInput) {
  const clean = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  };

  return {
    sinpe_phone: clean(input.sinpePhone),
    bank_name: clean(input.bankName),
    bank_account: clean(input.bankAccount),
  };
}

/** Whether a trader can receive fiat at all. */
export function hasAnyPaymentDetail(input: PaymentDetailsInput) {
  return Boolean(
    input.sinpePhone?.trim() ??
      (input.bankName?.trim() && input.bankAccount?.trim()),
  );
}
