type ReconfirmationEmail = {
  to: string;
  subject: string;
  advertTitle: string;
  confirmationUrl: string;
  reminder?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export async function sendReconfirmationEmail({
  to,
  subject,
  advertTitle,
  confirmationUrl,
  reminder = false,
}: ReconfirmationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECONFIRMATION_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "Missing RESEND_API_KEY or RECONFIRMATION_EMAIL_FROM for reconfirmation emails."
    );
  }

  const safeTitle = escapeHtml(advertTitle || "your advert");
  const preface = reminder
    ? "This is a reminder to confirm your OwnerCars advert is still available."
    : "Please confirm your OwnerCars advert is still available.";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: `
        <p>${preface}</p>
        <p><strong>${safeTitle}</strong></p>
        <p><a href="${confirmationUrl}">Confirm this car is still available</a></p>
        <p>If the car is no longer available, you can mark it sold from your seller dashboard.</p>
      `,
      text: `${preface}\n\n${advertTitle}\n\nConfirm it here: ${confirmationUrl}\n\nIf the car is no longer available, mark it sold from your seller dashboard.`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${text}`);
  }

  return response.json();
}
