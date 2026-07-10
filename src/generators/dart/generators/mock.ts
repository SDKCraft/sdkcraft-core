import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `'user@example.com'`;
    if (n === "id" || n.endsWith("id")) return `'mock-\${_rand.nextInt(100000)}'`;
    if (n.includes("name")) return `'Sample Name'`;
    if (n.includes("url") || n.includes("link")) return `'https://example.com'`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `DateTime.now().toIso8601String()`;
    return `'sample ${field.name}'`;
  }
  if (field.type === "integer") return `_rand.nextInt(100)`;
  if (field.type === "number") return `_rand.nextDouble() * 1000`;
  if (field.type === "boolean") return `_rand.nextBool()`;
  return `_build${field.type}()`;
}

/** يبني دالة `_buildX()` بترجع نسخة وهمية من كائن واحد (بس الحقول المطلوبة) */
function buildDartMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`  ${model.name} _build${model.name}() {`);
  lines.push(`    return ${model.name}(`);
  model.fields.filter(f => f.required).forEach(field => {
    lines.push(`      ${field.name}: ${fakeValueForField(field)},`);
  });
  lines.push(`    );`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني كل دوال build للـ models مجتمعة */
export function generateDartMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildDartMockFactory(model)));
  return lines;
}

/** يبني فتح كلاس MockClient */
export function generateDartMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/// MockClient — نفس واجهة Client، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.`);
  lines.push(`class MockClient {`);
  lines.push(`  final Duration latency;`);
  lines.push(`  static final Random _rand = Random();\n`);
  lines.push(`  MockClient({this.latency = const Duration(milliseconds: 200)});\n`);
  return lines;
}

/** إغلاق كلاس MockClient */
export function generateDartMockClientClose(): string[] {
  return [`}\n`];
}

/** يبني method واحد داخل MockClient (بنفس منطق positional/named زي Client) */
function buildDartMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = toCamelCase(endpoint.operationId);
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const dartReturnType = hasSchema ? (isArray ? `List<${baseType}>` : baseType) : `dynamic`;

  const positionalArgs: string[] = pathParams.map(p => `String ${p.name}`);
  const namedArgs: string[] = [];
  if (queryParams.length > 0) namedArgs.push(`Map<String, String>? params`);
  if (endpoint.requestBody) namedArgs.push(`Map<String, dynamic>? body`);

  const allArgs = [...positionalArgs];
  if (namedArgs.length > 0) allArgs.push(`{${namedArgs.join(", ")}}`);

  lines.push(`  /// ${endpoint.summary} (mock)`);
  lines.push(`  Future<${dartReturnType}> ${fnName}(${allArgs.join(", ")}) async {`);
  lines.push(`    await Future.delayed(latency);`);

  if (!hasSchema) {
    lines.push(`    return {};`);
  } else if (isArray) {
    lines.push(`    return [_build${baseType}(), _build${baseType}(), _build${baseType}()];`);
  } else {
    lines.push(`    return _build${baseType}();`);
  }

  lines.push(`  }\n`);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generateDartMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildDartMockEndpointFn(endpoint, modelNames)));
  return lines;
}
