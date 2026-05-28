export function getStripeMode(secretKey: string) {
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

export function assertStripeKeyMatchesExpectedMode(secretKey: string) {
  const expectedMode = process.env.STRIPE_MODE;

  if (!expectedMode) return;

  if (expectedMode !== "live" && expectedMode !== "test") {
    throw new Error("STRIPE_MODE must be either 'live' or 'test' when set");
  }

  const actualMode = getStripeMode(secretKey);

  if (actualMode !== expectedMode) {
    throw new Error(
      `STRIPE_SECRET_KEY is ${actualMode} but STRIPE_MODE expects ${expectedMode}`
    );
  }
}
