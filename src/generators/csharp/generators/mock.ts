import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-" + Guid.NewGuid().ToString("N").Substring(0, 8)`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `DateTime.UtcNow.ToString("o")`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `_rand.Next(1, 100)`;
  if (field.type === "number") return `Math.Round(_rand.NextDouble() * 1000, 2)`;
  if (field.type === "boolean") return `_rand.Next(2) == 1`;
  if (field.type.endsWith("[]")) {
    const itemType = field.type.slice(0, -2);
    if (itemType === "string" || itemType === "integer" || itemType === "number" || itemType === "boolean" || itemType === "unknown") {
      return `new List<object>()`;
    }
    return `new List<${itemType}> { Build${itemType}() }`;
  }
  if (field.type === "unknown") return `null`;
  return `Build${field.type}()`;
}

/** يبني دالة `BuildX()` بترجع نسخة وهمية من كائن واحد (بس الحقول المطلوبة) */
function buildCsMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`    private static ${model.name} Build${model.name}()`);
  lines.push(`    {`);
  lines.push(`        return new ${model.name}`);
  lines.push(`        {`);
  model.fields.filter(f => f.required).forEach(field => {
    const propName = toPascalCase(field.name);
    lines.push(`            ${propName} = ${fakeValueForField(field)},`);
  });
  lines.push(`        };`);
  lines.push(`    }\n`);
  return lines;
}

/** يبني كل دوال build للـ models مجتمعة (تُستخدم static random داخل MockClient) */
export function generateCsMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildCsMockFactory(model)));
  return lines;
}

/** يبني فتح كلاس MockClient */
export function generateCsMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`/// <summary>MockClient — نفس واجهة Client، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.</summary>`);
  lines.push(`public class MockClient`);
  lines.push(`{`);
  lines.push(`    private readonly int _latencyMs;`);
  lines.push(`    private static readonly Random _rand = new Random();\n`);
  lines.push(`    public MockClient(int latencyMs = 200)`);
  lines.push(`    {`);
  lines.push(`        _latencyMs = latencyMs;`);
  lines.push(`    }\n`);
  return lines;
}

/** يبني method واحد async داخل MockClient */
function buildCsMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = toPascalCase(endpoint.operationId) + "Async";
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const csReturnType = hasSchema ? (isArray ? `List<${baseType}>` : baseType) : `string`;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`string ${p.name}`));
  if (queryParams.length > 0) args.push(`Dictionary<string, string>? queryParams = null`);
  if (endpoint.requestBody) args.push(`string? body = null`);

  lines.push(`    /// <summary>${endpoint.summary} (mock)</summary>`);
  lines.push(`    public async Task<${csReturnType}> ${fnName}(${args.join(", ")})`);
  lines.push(`    {`);
  lines.push(`        await Task.Delay(_latencyMs);`);

  if (!hasSchema) {
    lines.push(`        return "{}";`);
  } else if (isArray) {
    lines.push(`        return new List<${baseType}> { Build${baseType}(), Build${baseType}(), Build${baseType}() };`);
  } else {
    lines.push(`        return Build${baseType}();`);
  }

  lines.push(`    }\n`);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generateCsMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildCsMockEndpointFn(endpoint, modelNames)));
  return lines;
}
