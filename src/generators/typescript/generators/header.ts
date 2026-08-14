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

  lines.push(`export interface RequestConfig {`);
  lines.push(`  url: string;`);
  lines.push(`  method: string;`);
  lines.push(`  headers: Record<string, string>;`);
  lines.push(`  body?: string;`);
  lines.push(`}`);
  lines.push(`export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;`);
  lines.push(`export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;\n`);

  return lines;
}

/**
 * يبني تصريح الكلاس + الـ constructor. لازم يتنفذ بعد error class وقبل الـ private request method.
 */
export function generateClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];
  const hasMultipleServers = (spec.servers?.length || 0) > 1;

  lines.push(`export class Client {`);
  lines.push(`  private baseUrl: string;`);
  lines.push(`  private apiKey: string | null;`);
  lines.push(`  private bearerToken: string | null;`);
  lines.push(`  private customHeaders: Record<string, string>;`);
  lines.push(`  private requestInterceptor?: RequestInterceptor;`);
  lines.push(`  private responseInterceptor?: ResponseInterceptor;\n`);
  if (hasMultipleServers) {
    lines.push(`  /** كل الـ servers المعرّفة في الـ OpenAPI spec (production, staging, إلخ) */`);
    lines.push(`  static readonly servers = ${JSON.stringify(spec.servers)} as const;\n`);
  }
  lines.push(`  constructor(options?: {`);
  lines.push(`    baseUrl?: string;`);
  lines.push(`    apiKey?: string;`);
  lines.push(`    bearerToken?: string;`);
  lines.push(`    /** هيدرز ثابتة تتضاف لكل request (زي X-Tenant-Id, X-Client-Version, إلخ) */`);
  lines.push(`    headers?: Record<string, string>;`);
  lines.push(`    /** بتتنفذ قبل كل request، بتقدر تعدّل الـ url/method/headers/body (مفيدة لتوكنات بتتجدد، custom signing، logging) */`);
  lines.push(`    requestInterceptor?: RequestInterceptor;`);
  lines.push(`    /** بتتنفذ بعد كل response وقبل فحص res.ok (مفيدة لمعالجة أخطاء موحدة أو logging) */`);
  lines.push(`    responseInterceptor?: ResponseInterceptor;`);
  lines.push(`  }) {`);
  lines.push(`    this.baseUrl = options?.baseUrl ?? "${spec.baseUrl}";`);
  lines.push(`    this.apiKey = options?.apiKey ?? null;`);
  lines.push(`    this.bearerToken = options?.bearerToken ?? null;`);
  lines.push(`    this.customHeaders = options?.headers ?? {};`);
  lines.push(`    this.requestInterceptor = options?.requestInterceptor;`);
  lines.push(`    this.responseInterceptor = options?.responseInterceptor;`);
  lines.push(`  }\n`);

  return lines;
}

/** يبني قفل الكلاس */
export function generateClientClose(): string[] {
  return [`}\n`];
}