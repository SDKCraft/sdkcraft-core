/**
 * يبني كلاس SDKError المخصص — بيحمل status code وbody الاستجابة
 * بدل Error عام، عشان المستخدم يقدر يعمل type-narrowing ويتعامل مع الأخطاء بدقة.
 */
export function generateErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`export class SDKError extends Error {`);
  lines.push(`  readonly status: number;`);
  lines.push(`  readonly body: unknown;`);
  lines.push(`  readonly isRetryable: boolean;\n`);
  lines.push(`  constructor(message: string, status: number, body: unknown, isRetryable = false) {`);
  lines.push(`    super(message);`);
  lines.push(`    this.name = "SDKError";`);
  lines.push(`    this.status = status;`);
  lines.push(`    this.body = body;`);
  lines.push(`    this.isRetryable = isRetryable;`);
  lines.push(`  }`);
  lines.push(`}\n`);

  return lines;
}
