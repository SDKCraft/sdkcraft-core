import { ApiSpec } from "../../../parsers/openapi-parser";

/**
 * يبني الجزء العلوي من الملف المولَّد:
 * - استيراد zod لو فيه models (لازم يكون أول سطر في الملف)
 * - تعليق الترويسة (اسم الـ API + النسخة)
 * - تعريف BASE_URL
 * - دوال ضبط المصادقة (API Key / Bearer Token)
 */
export function generateHeader(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  if (hasModels) {
    lines.push(`import { z } from 'zod';\n`);
  }

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually\n`);
  lines.push(`const BASE_URL = "${spec.baseUrl}";\n`);

  lines.push(`let _apiKey: string | null = null;`);
  lines.push(`let _bearerToken: string | null = null;\n`);

  lines.push(`export function setApiKey(key: string): void {`);
  lines.push(`  _apiKey = key;`);
  lines.push(`}\n`);

  lines.push(`export function setBearerToken(token: string): void {`);
  lines.push(`  _bearerToken = token;`);
  lines.push(`}\n`);

  return lines;
}
