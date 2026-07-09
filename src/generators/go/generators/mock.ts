import { Model, ModelField, Endpoint } from "../../../parsers/openapi-parser";

const GO_INITIALISMS: Record<string, string> = { Id: "ID", Url: "URL", Api: "API" };

function toPascalCase(name: string): string {
  let result = name.charAt(0).toUpperCase() + name.slice(1);
  Object.entries(GO_INITIALISMS).forEach(([raw, fixed]) => {
    result = result.replace(new RegExp(`${raw}(?=[A-Z]|$)`, "g"), fixed);
  });
  return result;
}

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `fmt.Sprintf("mock-%d", rand.Intn(100000))`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `time.Now().Format(time.RFC3339)`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `rand.Intn(100)`;
  if (field.type === "number") return `rand.Float64() * 1000`;
  if (field.type === "boolean") return `rand.Intn(2) == 1`;
  return `build${field.type}()`;
}

/** يبني اسم الحقل بصيغة PascalCase مع مراعاة id -> ID (نفس منطق models.ts) */
function fieldNamePascal(name: string): string {
  return toPascalCase(name === "id" ? "ID" : name);
}

/** يبني دالة `buildX()` بترجع نسخة وهمية من struct واحد (بس الحقول المطلوبة) */
function buildGoMockFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`func build${model.name}() ${model.name} {`);
  lines.push(`  return ${model.name}{`);
  model.fields.filter(f => f.required).forEach(field => {
    lines.push(`    ${fieldNamePascal(field.name)}: ${fakeValueForField(field)},`);
  });
  lines.push(`  }`);
  lines.push(`}\n`);
  return lines;
}

/** يبني كل دوال build للـ models */
export function generateGoMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildGoMockFactory(model)));
  return lines;
}

/** يبني struct MockClient + constructor */
export function generateGoMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`// MockClient — نفس واجهة Client، لكن بيرجّع بيانات وهمية بدل الاتصال بالشبكة.`);
  lines.push(`type MockClient struct {`);
  lines.push(`  LatencyMs int`);
  lines.push(`}\n`);
  lines.push(`func NewMockClient() *MockClient {`);
  lines.push(`  return &MockClient{LatencyMs: 200}`);
  lines.push(`}\n`);
  return lines;
}

/** يبني method واحد داخل MockClient */
function buildGoMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = toPascalCase(endpoint.operationId);
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const goReturnType = hasSchema ? (isArray ? `[]${baseType}` : baseType) : `map[string]interface{}`;

  const args: string[] = ["ctx context.Context"];
  pathParams.forEach(p => args.push(`${p.name} string`));
  if (queryParams.length > 0) args.push(`params map[string]string`);
  if (endpoint.requestBody) args.push(`body map[string]interface{}`);

  lines.push(`// ${endpoint.summary} (mock)`);
  lines.push(`func (c *MockClient) ${fnName}(${args.join(", ")}) (${goReturnType}, error) {`);
  lines.push(`  time.Sleep(time.Duration(c.LatencyMs) * time.Millisecond)`);

  if (!hasSchema) {
    lines.push(`  return map[string]interface{}{}, nil`);
  } else if (isArray) {
    lines.push(`  return []${baseType}{build${baseType}(), build${baseType}(), build${baseType}()}, nil`);
  } else {
    lines.push(`  return build${baseType}(), nil`);
  }

  lines.push(`}\n`);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generateGoMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildGoMockEndpointFn(endpoint, modelNames)));
  return lines;
}
