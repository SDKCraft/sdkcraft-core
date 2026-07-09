import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

/** أسماء تتعارض مع builtins أو keywords في بايثون، لازم تتفادى كأسماء متغيرات */
const PY_RESERVED = new Set([
  "id", "type", "list", "dict", "str", "int", "float", "bool",
  "format", "input", "object", "class", "filter", "map", "len", "hash",
]);

/** يضيف underscore لاسم الباراميتر لو بيتعارض مع builtin بايثون */
function safePyParamName(name: string): string {
  return PY_RESERVED.has(name) ? `${name}_param` : name;
}

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-" + str(uuid.uuid4())[:8]`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `datetime.utcnow().isoformat()`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `random.randint(1, 100)`;
  if (field.type === "number") return `round(random.uniform(1, 1000), 2)`;
  if (field.type === "boolean") return `random.choice([True, False])`;
  return `_build_${toSnakeCase(field.type)}()`;
}

/** يبني دالة `_build_x()` بترجع نسخة وهمية من موديل واحد */
function buildPyMockFactory(model: Model): string[] {
  const lines: string[] = [];
  const fnName = `_build_${toSnakeCase(model.name)}`;
  lines.push(`def ${fnName}():`);
  lines.push(`    return ${model.name}(`);
  model.fields.filter(f => f.required).forEach(field => {
    lines.push(`        ${field.name}=${fakeValueForField(field)},`);
  });
  lines.push(`    )`);
  lines.push(``);
  return lines;
}

/** يبني كل دوال build للـ models */
export function generatePyMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildPyMockFactory(model)));
  return lines;
}

/** يبني imports إضافية مطلوبة للـ mock (uuid, random, datetime) */
export function generatePyMockImports(): string[] {
  return [`import random`, `import uuid`, `from datetime import datetime`, ``];
}

/** فتح كلاس MockClient */
export function generatePyMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`class MockClient:`);
  lines.push(`    """Same interface as Client, but returns realistic fake data instead of calling the network."""`);
  lines.push(``);
  lines.push(`    def __init__(self, latency: float = 0.2):`);
  lines.push(`        self.latency = latency`);
  lines.push(``);
  return lines;
}

/** يبني method واحد داخل MockClient (نفس توقيع الميثود المقابل في Client، بما فيه أسماء الباراميترات الآمنة) */
function buildPyMockEndpointFn(endpoint: Endpoint): string[] {
  const lines: string[] = [];
  const fnName = toSnakeCase(endpoint.operationId);
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const factoryName = `_build_${toSnakeCase(baseType)}`;

  const args: string[] = ["self"];
  pathParams.forEach(p => args.push(safePyParamName(p.name)));
  if (queryParams.length > 0) args.push(`params: Optional[dict] = None`);
  if (endpoint.requestBody) args.push(`body: Optional[dict] = None`);

  lines.push(`    def ${fnName}(${args.join(", ")}):`);
  lines.push(`        """${endpoint.summary} (mock)"""`);
  lines.push(`        time.sleep(self.latency)`);

  if (baseType === "") {
    lines.push(`        return None`);
  } else if (isArray) {
    lines.push(`        return [${factoryName}(), ${factoryName}(), ${factoryName}()]`);
  } else {
    lines.push(`        return ${factoryName}()`);
  }

  lines.push(``);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generatePyMockEndpoints(endpoints: Endpoint[]): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildPyMockEndpointFn(endpoint)));
  return lines;
}
