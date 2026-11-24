export const VALID_DOCUMENT_TYPES = ['mot', 'service_history', 'v5c', 'video_link'] as const;
export type DocumentType = typeof VALID_DOCUMENT_TYPES[number];

export const DOCUMENT_DISPLAY_NAMES: Record<DocumentType, string> = {
  mot: 'MOT certificate',
  service_history: 'service history',
  v5c: 'redacted V5C',
  video_link: 'video link',
};

export function isValidDocumentType(value: unknown): value is DocumentType {
  return VALID_DOCUMENT_TYPES.includes(value as DocumentType);
}

// Video links are shown to buyers as a clickable link, so only https links to
// the main video sites are accepted: anything else could send a buyer to a
// fake payment or "escrow" page.
const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com"];

export function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, "");
    return parsed.protocol === "https:" && VIDEO_HOSTS.includes(host);
  } catch {
    return false;
  }
}
