import type { ParsedLeads } from "../types/leads";

const emailCandidateRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const strictEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().replace(/^mailto:/i, "");
}

function isValidEmail(value: string) {
  return strictEmailRegex.test(value) && value.length <= 254;
}

function extractInvalidEmailLikeEntries(content: string, validEmails: Set<string>) {
  const tokenRegex = /(?:mailto:)?[^\s,;"'<>()[\]{}]+@[^\s,;"'<>()[\]{}]*/gi;
  const invalidEntries = new Set<string>();
  const matches = content.match(tokenRegex) ?? [];

  for (const rawMatch of matches) {
    const normalized = normalizeEmail(rawMatch).replace(/[).]+$/g, "");

    if (!validEmails.has(normalized) && !isValidEmail(normalized)) {
      invalidEntries.add(rawMatch.trim());
    }
  }

  return Array.from(invalidEntries);
}

export function parseLeadText(content: string, filename: string): ParsedLeads {
  const uniqueEmails = new Set<string>();
  const matches = content.match(emailCandidateRegex) ?? [];
  let duplicateCount = 0;

  for (const match of matches) {
    const email = normalizeEmail(match);

    if (!isValidEmail(email)) {
      continue;
    }

    if (uniqueEmails.has(email)) {
      duplicateCount += 1;
      continue;
    }

    uniqueEmails.add(email);
  }

  return {
    filename,
    validEmails: Array.from(uniqueEmails),
    invalidEntries: extractInvalidEmailLikeEntries(content, uniqueEmails).slice(0, 20),
    duplicateCount,
    totalMatches: matches.length
  };
}

export function isSupportedLeadFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "csv" || extension === "txt" || file.type === "text/csv" || file.type === "text/plain";
}
