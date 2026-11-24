// Phrases common in "I'll buy your car" scams. Client-safe. Used to show the
// seller a warning on a message that matches: these messages aren't blocked
// (a genuine buyer might mention a courier), but the seller should know the
// pattern. Contact details themselves are already blocked on send.

const SIGNALS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(finali[sz]e|complete|close)\s+(the\s+)?(deal|sale|transaction|payment)\b/i, label: "pressure to finalise quickly" },
  { pattern: /\b(courier|shipping|shipper|transport(er)?\s+(company|agent)|collection\s+agent|pick[\s-]?up\s+agent|my\s+agent|logistics)\b/i, label: "a courier or agent collecting" },
  { pattern: /\b(paypal|bank\s+transfer|wire\s+transfer|western\s+union|moneygram|crypto|bitcoin|escrow|cashier'?s\s+cheque|gift\s+card)\b/i, label: "an unusual payment method" },
  { pattern: /\b(verification|security|confirmation)\s+code\b|\bsend\s+(me\s+)?(the\s+)?code\b/i, label: "a request for a code" },
  { pattern: /\b(v5c?|logbook|log\s+book)\b.*\b(photo|picture|pic|send|copy)\b|\b(photo|picture|pic|send|copy)\b.*\b(v5c?|logbook|log\s+book)\b/i, label: "a request for logbook photos" },
  { pattern: /\b(deposit|refund|overpa(y|id)|extra\s+money|reimburse)\b/i, label: "deposits, refunds or overpayment" },
  { pattern: /\b(outside|off)\s+(of\s+)?(this\s+)?(site|platform|ownercars|app)\b|\bmore\s+privately\b|\b(email|text|ring|call)\s+(you|me)\s+directly\b/i, label: "moving the conversation elsewhere" },
  { pattern: /\b(whats\s*-?\s*app|whatapp|watsapp|telegram|viber|signal\s+(me|app)|on\s+signal|wechat|snapchat|instagram|insta)\b/i, label: "moving the conversation to WhatsApp or another app" },
  { pattern: /\b(abroad|overseas|offshore|working\s+on\s+(an\s+)?(oil\s+)?rig|deployed|at\s+sea)\b/i, label: "a buyer who says they're away" },
];

export function scamSignals(text: string): string[] {
  return SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.label);
}
