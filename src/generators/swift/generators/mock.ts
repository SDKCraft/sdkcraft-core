import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-" + String(UUID().uuidString.prefix(8))`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `ISO8601DateFormatter().string(from: Date())`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `Int.random(in: 1...100)`;
  if (field.type === "number") return `Double.random(in: 1...1000)`;
  if (field.type === "boolean") return `Bool.random()`;
  return `build${field.type}()`;
}

/** يبني دالة `buildX()` بترجع نسخة وهمية من struct واحد (بس الحقول المطلوبة) */
function buildSwiftMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`  private func build${model.name}() -> ${model.name} {`);
  lines.push(`    return ${model.name}(`);
  const required = model.fields.filter(f => f.required);
  required.forEach((field, i) => {
    const comma = i < required.length - 1 ? "," : "";
    lines.push(`      ${field.name}: ${fakeValueForField(field)}${comma}`);
  });
  lines.push(`    )`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني كل دوال build للـ models مجتمعة (methods private جوه MockClient) */
export function generateSwiftMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildSwiftMockFactory(model)));
  return lines;
}

/** يبني فتح كلاس MockClient */
export function generateSwiftMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/// MockClient — نفس واجهة Client، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.`);
  lines.push(`class MockClient {`);
  lines.push(`  private let latencySeconds: Double\n`);
  lines.push(`  init(latencySeconds: Double = 0.2) {`);
  lines.push(`    self.latencySeconds = latencySeconds`);
  lines.push(`  }\n`);
  return lines;
}

/** إغلاق كلاس MockClient */
export function generateSwiftMockClientClose(): string[] {
  return [`}\n`];
}

/** يبني func async واحدة داخل MockClient */
function buildSwiftMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = endpoint.operationId;
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const swiftReturnType = hasSchema ? (isArray ? `[${baseType}]` : baseType) : `Data`;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`${p.name}: ${p.type === "integer" ? "Int" : "String"}`));
  if (queryParams.length > 0) args.push(`params: [String: String]? = nil`);
  if (endpoint.requestBodyModel) {
    args.push(`body: ${endpoint.requestBodyModel}? = nil`);
  }

  lines.push(`  /// ${endpoint.summary} (mock)`);
  lines.push(`  func ${fnName}(${args.join(", ")}) async throws -> ${swiftReturnType} {`);
  lines.push(`    try await Task.sleep(nanoseconds: UInt64(latencySeconds * 1_000_000_000))`);

  if (!hasSchema) {
    lines.push(`    return Data()`);
  } else if (isArray) {
    lines.push(`    return [build${baseType}(), build${baseType}(), build${baseType}()]`);
  } else {
    lines.push(`    return build${baseType}()`);
  }

  lines.push(`  }\n`);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generateSwiftMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildSwiftMockEndpointFn(endpoint, modelNames)));
  return lines;
}
