export const LISTING_PRICE_GBP = 2.5;
export const LISTING_PRICE_AMOUNT_PENCE = Math.round(LISTING_PRICE_GBP * 100);
export const STANDARD_LISTING_PRICE_GBP = 9.99;

export function formatListingPrice(amountPence = LISTING_PRICE_AMOUNT_PENCE) {
  return `£${(amountPence / 100).toFixed(2)}`;
}
