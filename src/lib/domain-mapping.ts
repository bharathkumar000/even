"use strict";

/**
 * Domain mapping utility for problem statement department filtering.
 *
 * Maps raw database `department` values to the three public filter categories.
 * All comparison is case- and whitespace-insensitive.
 *
 * Mapping:
 *   CSE/AIML   <- "CSE/AIML", "CSE", "AIML", "CSE / AIML", etc.
 *   ECE/EEE    <- "ECE", "EEE", "ECE/EEE", "ECE and EEE", etc.
 *   ME/CV      <- "MECHANICAL", "CIVIL", "ME", "CV", "ME/CV", etc.
 *
 * Returns null for missing or unrecognized departments.
 */

type DomainCategory = "cse-aiml" | "ece-eee" | "me-cv" | null;

const NORMALIZE_RE = /[\s\/&-]+/g;

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .trim()
    .toUpperCase()
    .replace(NORMALIZE_RE, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/**
 * Map a raw database department value to a public domain category.
 * Returns null if the department is missing or unrecognized.
 */
export function mapDepartmentToDomain(department: string | null | undefined): DomainCategory {
  const norm = normalize(department);
  if (!norm) return null;

  // CSE/AIML
  if (
    norm === "CSE/AIML" ||
    norm === "CSE" ||
    norm === "AIML" ||
    norm === "CSEAIML" ||
    norm === "CSE/AIML/"
  ) {
    return "cse-aiml";
  }

  // ECE/EEE
  if (
    norm === "ECE/EEE" ||
    norm === "ECE" ||
    norm === "EEE" ||
    norm === "ECEEEE" ||
    norm === "ECE/EEE/"
  ) {
    return "ece-eee";
  }

  // ME/CV (Mechanical and Civil)
  if (
    norm === "ME/CV" ||
    norm === "MECHANICAL" ||
    norm === "CIVIL" ||
    norm === "ME" ||
    norm === "CV" ||
    norm === "MECV" ||
    norm === "ME/CV/"
  ) {
    return "me-cv";
  }

  // Unrecognized department - return null so caller can handle as unmapped
  return null;
}

/**
 * Public labels for each domain category.
 */
export const DOMAIN_LABELS: Record<Exclude<DomainCategory, null>, { label: string; subtitle: string }> = {
  cse-aiml: { label: "CSE / AIML", subtitle: "Computer Science & AI/ML" },
  ece-eee: { label: "ECE / EEE", subtitle: "Electronics & Electrical" },
  me-cv: { label: "ME / CV", subtitle: "Mechanical & Civil" },
};

/**
 * Check if a department value maps to a given domain category.
 */
export function departmentBelongsToDomain(
  department: string | null | undefined,
  domain: "cse-aiml" | "ece-eee" | "me-cv"
): boolean {
  return mapDepartmentToDomain(department) === domain;
}

/**
 * Filter an array of records by domain category using their department field.
 * Records with missing/unrecognized departments are excluded unless domain is null (not used here).
 */
export function filterByDomain<T extends { department?: string | null }>(
  records: T[],
  domain: "cse-aiml" | "ece-eee" | "me-cv"
): T[] {
  return records.filter((r) => departmentBelongsToDomain(r.department, domain));
}
