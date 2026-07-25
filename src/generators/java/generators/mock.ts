import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل (باستخدام الـ setter المقابل) */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-" + java.util.UUID.randomUUID().toString().substring(0, 8)`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `java.time.Instant.now().toString()`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `(int)(Math.random() * 100)`;
  if (field.type === "number") return `Math.round(Math.random() * 100000) / 100.0`;
  if (field.type === "boolean") return `Math.random() > 0.5`;
  if (field.type.endsWith("[]")) {
    const itemType = field.type.slice(0, -2);
    if (itemType === "string" || itemType === "integer" || itemType === "number" || itemType === "boolean" || itemType === "unknown") {
      return `java.util.Collections.emptyList()`;
    }
    return `java.util.Arrays.asList(build${itemType}())`;
  }
  if (field.type === "unknown") return `null`;
  return `build${field.type}()`;
}

/** يبني دالة `buildX()` بترجع POJO وهمي واحد (بس الحقول المطلوبة) */
function buildJavaMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`  private static ${model.name} build${model.name}() {`);
  lines.push(`    ${model.name} obj = new ${model.name}();`);
  model.fields.filter(f => f.required).forEach(field => {
    const capitalized = field.name.charAt(0).toUpperCase() + field.name.slice(1);
    lines.push(`    obj.set${capitalized}(${fakeValueForField(field)});`);
  });
  lines.push(`    return obj;`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني كل دوال build للـ models مجتمعة (static methods جوه MockApiClient) */
export function generateJavaMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildJavaMockFactory(model)));
  return lines;
}

/** يبني فتح كلاس MockApiClient */
export function generateJavaMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/** MockApiClient — نفس واجهة ApiClient، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة. */`);
  lines.push(`class MockApiClient {`);
  lines.push(`  private final long latencyMs;\n`);
  lines.push(`  public MockApiClient() { this(200); }`);
  lines.push(`  public MockApiClient(long latencyMs) { this.latencyMs = latencyMs; }\n`);
  lines.push(`  private void sleep() {`);
  lines.push(`    try { Thread.sleep(latencyMs); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني method واحد داخل MockApiClient */
function buildJavaMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = endpoint.operationId;
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const javaReturnType = hasSchema ? (isArray ? `java.util.List<${baseType}>` : baseType) : `String`;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`String ${p.name}`));
  if (queryParams.length > 0) args.push(`Map<String, String> params`);
  if (endpoint.requestBody) args.push(`String body`);

  lines.push(`  /** ${endpoint.summary} (mock) */`);
  lines.push(`  public ${javaReturnType} ${fnName}(${args.join(", ")}) {`);
  lines.push(`    sleep();`);

  if (!hasSchema) {
    lines.push(`    return "{}";`);
  } else if (isArray) {
    lines.push(`    return java.util.List.of(build${baseType}(), build${baseType}(), build${baseType}());`);
  } else {
    lines.push(`    return build${baseType}();`);
  }

  lines.push(`  }\n`);
  return lines;
}

/** يبني كل methods الـ MockApiClient */
export function generateJavaMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildJavaMockEndpointFn(endpoint, modelNames)));
  return lines;
}
