import { NextResponse } from "next/server";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
