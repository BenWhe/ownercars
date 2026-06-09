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
