"use client";

import { v4 as uuidv4 } from "uuid";

export function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function ensureUuid(id: string): string {
  return isUuid(id) ? id : uuidv4();
}

export function generateId(): string {
  return uuidv4();
}

