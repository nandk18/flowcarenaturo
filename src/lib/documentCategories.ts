export const DOCUMENT_CATEGORIES = [
  "Medical Report",
  "Prescription",
  "Insurance",
  "ID Proof",
  "Lab Report",
  "Other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const MAX_DOC_SIZE_MB = 10;
export const MAX_PUBLIC_DOC_SIZE_MB = 5;
export const MAX_PUBLIC_DOC_COUNT = 3;

export const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ACCEPTED_EXT = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

export function iconForType(fileType: string | null | undefined) {
  if (!fileType) return "file";
  if (fileType.startsWith("image/")) return "image";
  if (fileType === "application/pdf") return "pdf";
  if (fileType.includes("word")) return "doc";
  return "file";
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
