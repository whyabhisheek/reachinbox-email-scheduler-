import { describe, expect, it } from "vitest";
import { isSupportedLeadFile, parseLeadText } from "./leadParser";

describe("parseLeadText", () => {
  it("extracts valid emails from CSV content", () => {
    const result = parseLeadText("alice@example.com,bob@example.com\ncarol@example.com", "leads.csv");

    expect(result.validEmails).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com"
    ]);
    expect(result.invalidEntries).toEqual([]);
    expect(result.totalMatches).toBe(3);
  });

  it("normalizes case and trims whitespace", () => {
    const result = parseLeadText("  ALICE@Example.COM \n bob@example.com ", "leads.txt");

    expect(result.validEmails).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("deduplicates repeated emails and counts them", () => {
    const result = parseLeadText("a@example.com\na@example.com\nb@example.com", "leads.txt");

    expect(result.validEmails).toEqual(["a@example.com", "b@example.com"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("strips mailto: prefixes", () => {
    const result = parseLeadText("mailto:a@example.com, b@example.com", "leads.txt");

    expect(result.validEmails).toEqual(["a@example.com", "b@example.com"]);
  });

  it("flags invalid email-like entries", () => {
    const result = parseLeadText("a@example.com\nnot-an-email\nb@broken", "leads.txt");

    expect(result.validEmails).toEqual(["a@example.com"]);
    expect(result.invalidEntries.length).toBeGreaterThan(0);
  });

  it("returns no valid emails for empty content", () => {
    const result = parseLeadText("", "leads.txt");

    expect(result.validEmails).toEqual([]);
    expect(result.duplicateCount).toBe(0);
  });

  it("ignores emails longer than 254 characters", () => {
    const longEmail = `${"a".repeat(250)}@example.com`;
    const result = parseLeadText(`short@example.com,${longEmail}`, "leads.txt");

    expect(result.validEmails).toEqual(["short@example.com"]);
  });
});

describe("isSupportedLeadFile", () => {
  it("accepts csv and txt extensions", () => {
    expect(isSupportedLeadFile({ name: "leads.csv" } as File)).toBe(true);
    expect(isSupportedLeadFile({ name: "leads.txt" } as File)).toBe(true);
  });

  it("rejects unsupported files", () => {
    expect(isSupportedLeadFile({ name: "leads.pdf" } as File)).toBe(false);
    expect(isSupportedLeadFile({ name: "leads.xlsx" } as File)).toBe(false);
  });
});
