import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function slugify(value: string): string {
  return value
    .toString()
    .normalize('NFD') // separate accent from letters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

