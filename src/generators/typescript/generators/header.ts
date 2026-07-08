import { ApiSpec } from "../../../parsers/openapi-parser";

/**
 * يبني الجزء العلوي من الملف المولَّد:
 * - استيراد zod لو فيه models (لازم يكون أول سطر في الملف)
 * - تعليق الترويسة (اسم الـ API + النسخة)
 * - فتح كلاس الـ Client مع constructor لاستقبال baseUrl/apiKey/bearerToken
 */
export function generateHeader(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  if (hasModels) {
    lines.push(`import { z } from 'zod';\n`);
  }

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually\n`);

  return lines;
}

/**
 * يبني تصريح الكلاس + الـ constructor. لازم يتنفذ بعد error class وقبل الـ private request method.
 */
export function generateClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`export class Client {`);
  lines.push(`  private baseUrl: string;`);
  lines.push(`  private apiKey: string | null;`);
  lines.push(`  private bearerToken: string | null;\n`);
  lines.push(`  constructor(options?: { baseUrl?: string; apiKey?: string; bearerToken?: string }) {`);
  lines.push(`    this.baseUrl = options?.baseUrl ?? "${spec.baseUrl}";`);
  lines.push(`    this.apiKey = options?.apiKey ?? null;`);
  lines.push(`    this.bearerToken = options?.bearerToken ?? null;`);
  lines.push(`  }\n`);

  return lines;
}

/** يبني قفل الكلاس */
export function generateClientClose(): string[] {
  return [`}\n`];
}
