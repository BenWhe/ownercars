// Reasons a recipient can give when reporting a message. Client-safe.
export const REPORT_REASONS = {
  scam: "Looks like a scam",
  off_platform: "Asked me to continue somewhere else (WhatsApp, email, phone)",
  payment: "Strange payment, courier or agent request",
  abusive: "Abusive or offensive",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
