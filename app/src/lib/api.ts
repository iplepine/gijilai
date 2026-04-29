import { NextResponse } from 'next/server';

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export class InvalidJsonBodyError extends Error {
  constructor() {
    super('Invalid JSON request body');
    this.name = 'InvalidJsonBodyError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function isInvalidJsonBodyError(error: unknown): error is InvalidJsonBodyError {
  return error instanceof InvalidJsonBodyError;
}

export function invalidJsonResponse() {
  return NextResponse.json({ error: 'INVALID_JSON_BODY' }, { status: 400 });
}

export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('INVALID_JSON_RESPONSE');
  }
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    if (typeof payload.error === 'string' && payload.error) {
      return payload.error;
    }

    if (typeof payload.message === 'string' && payload.message) {
      return payload.message;
    }
  }

  return fallback;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
