import { Endpoint } from "../../../parsers/openapi-parser";

/**
 * يبني method واحد داخل MockClient لكل endpoint، بنفس توقيع (signature) الميثود
 * المقابل في Client الحقيقي، لكن بيرجّع بيانات وهمية بدل استدعاء الشبكة.
 * لأي endpoint بيرجع array، بيرجّع مصفوفة من 3 عناصر وهمية كعينة واقعية.
 */
function buildMockEndpointFn(endpoint: Endpoint): string[] {
  const lines: string[] = [];

  const fnName = endpoint.operationId;
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "unknown";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const returnType = rawType;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`${p.name}: ${p.type === "integer" ? "number" : "string"}`));
  if (queryParams.length > 0) args.push(`params?: Record<string, string>`);
  if (endpoint.requestBodyModel) {
    args.push(`body?: ${endpoint.requestBodyModel}`);
  } else if (endpoint.requestBody) {
    args.push(`body?: Record<string, unknown>`);
  }

  lines.push(`  /** ${endpoint.summary} (mock) */`);
  lines.push(`  async ${fnName}(${args.join(", ")}): Promise<${returnType}> {`);
  lines.push(`    await new Promise(r => setTimeout(r, this.latencyMs));`);

  if (baseType === "unknown") {
    lines.push(`    return undefined as unknown as ${returnType};`);
  } else if (isArray) {
    lines.push(`    return [build${baseType}(), build${baseType}(), build${baseType}()];`);
  } else {
    lines.push(`    return build${baseType}();`);
  }

  lines.push(`  }\n`);

  return lines;
}

/** يبني كل methods الـ MockClient مجتمعة */
export function generateMockEndpoints(endpoints: Endpoint[]): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildMockEndpointFn(endpoint));
  });
  return lines;
}

/** يبني فتح كلاس MockClient مع latency وهمي قابل للتخصيص */
export function generateMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * MockClient — نفس واجهة Client بالضبط، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.`);
  lines.push(` * مفيد لتطوير الفرونت إند قبل جاهزية الـ backend، أو لكتابة اختبارات بدون سيرفر حقيقي.`);
  lines.push(` * الاستخدام: const client = new MockClient(); // نفس استدعاءات Client تمامًا`);
  lines.push(` */`);
  lines.push(`export class MockClient {`);
  lines.push(`  private latencyMs: number;\n`);
  lines.push(`  constructor(options?: { latencyMs?: number }) {`);
  lines.push(`    this.latencyMs = options?.latencyMs ?? 200;`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني قفل كلاس MockClient */
export function generateMockClientClose(): string[] {
  return [`}\n`];
}
