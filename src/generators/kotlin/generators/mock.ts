import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
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
  if (field.type === "integer") return `(1..100).random()`;
  if (field.type === "number") return `Math.round((0..100000).random() / 100.0 * 100) / 100.0`;
  if (field.type === "boolean") return `listOf(true, false).random()`;
  if (field.type.endsWith("[]")) {
    const itemType = field.type.slice(0, -2);
    if (itemType === "string" || itemType === "integer" || itemType === "number" || itemType === "boolean" || itemType === "unknown") {
      return `emptyList()`;
    }
    return `listOf(build${itemType}())`;
  }
  if (field.type === "unknown") return `null`;
  return `build${field.type}()`;
}

/** يبني دالة `buildX()` بترجع نسخة وهمية من data class واحد (بس الحقول المطلوبة) */
function buildKtMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`  private fun build${model.name}(): ${model.name} {`);
  lines.push(`    return ${model.name}(`);
  const required = model.fields.filter(f => f.required);
  required.forEach((field, i) => {
    const comma = i < required.length - 1 ? "," : "";
    lines.push(`      ${field.name} = ${fakeValueForField(field)}${comma}`);
  });
  lines.push(`    )`);
  lines.push(`  }\n`);
  return lines;
}

/** يبني كل دوال build للـ models مجتمعة (دوال private جوه MockClient) */
export function generateKtMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildKtMockFactory(model)));
  return lines;
}

/** يبني فتح كلاس MockClient */
export function generateKtMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/** MockClient — نفس واجهة Client، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة. */`);
  lines.push(`class MockClient(private val latencyMs: Long = 200) {\n`);
  return lines;
}

/** إغلاق كلاس MockClient */
export function generateKtMockClientClose(): string[] {
  return [`}\n`];
}

/** يبني suspend fun واحدة داخل MockClient */
function buildKtMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = endpoint.operationId;
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const ktReturnType = hasSchema ? (isArray ? `List<${baseType}>` : baseType) : `String`;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`${p.name}: ${p.type === "integer" ? "Int" : "String"}`));
  if (queryParams.length > 0) args.push(`params: Map<String, String>? = null`);
  if (endpoint.requestBody) args.push(`body: String? = null`);

  lines.push(`  /** ${endpoint.summary} (mock) */`);
  lines.push(`  suspend fun ${fnName}(${args.join(", ")}): ${ktReturnType} {`);
  lines.push(`    kotlinx.coroutines.delay(latencyMs)`);

  if (!hasSchema) {
    lines.push(`    return "{}"`);
  } else if (isArray) {
    lines.push(`    return listOf(build${baseType}(), build${baseType}(), build${baseType}())`);
  } else {
    lines.push(`    return build${baseType}()`);
  }

  lines.push(`  }\n`);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generateKtMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildKtMockEndpointFn(endpoint, modelNames)));
  return lines;
}
