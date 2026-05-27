export const ADVERT_STATUS = {
  DRAFT: "draft",
  PENDING_PAYMENT: "pending_payment",
  PUBLISHED: "published",
  PAUSED: "paused",
  SOLD: "sold",
} as const;

export type AdvertStatus = (typeof ADVERT_STATUS)[keyof typeof ADVERT_STATUS];

export function isPublicAdvertStatus(status?: string | null) {
  return status === ADVERT_STATUS.PUBLISHED;
}

export function sellerStatusLabel(status?: string | null) {
  switch (status) {
    case ADVERT_STATUS.DRAFT:
      return "Draft";
    case ADVERT_STATUS.PENDING_PAYMENT:
      return "Pending payment";
    case ADVERT_STATUS.PUBLISHED:
      return "Published";
    case ADVERT_STATUS.PAUSED:
      return "Paused";
    case ADVERT_STATUS.SOLD:
      return "Sold";
    default:
      return status || "Unknown";
  }
}

export function nextConfirmationDueDate(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 30);
  return next.toISOString();
}

export function reminderDueDate(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 7);
  return next.toISOString();
}

export function pauseDueDate(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 3);
  return next.toISOString();
}
