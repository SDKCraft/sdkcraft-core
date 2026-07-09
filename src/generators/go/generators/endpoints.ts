import { Endpoint } from "../../../parsers/openapi-parser";

/** كلمات initialism بيحوّلها Go convention لحروف كبيرة بالكامل (Id -> ID, Url -> URL) */
const GO_INITIALISMS: Record<string, string> = { Id: "ID", Url: "URL", Api: "API" };

/** يحوّل operationId لصيغة PascalCase مع مراعاة الـ initialisms (اسم method مصدَّر في Go) */
function toPascalCase(name: string): string {
  let result = name.charAt(0).toUpperCase() + name.slice(1);
  Object.entries(GO_INITIALISMS).forEach(([raw, fixed]) => {
    result = result.replace(new RegExp(`${raw}(?=[A-Z]|$)`, "g"), fixed);
  });
  return result;
}

/**
 * يبني method واحد على *Client لكل endpoint.
 * لو الاستجابة model معروف، بيرجّع typed struct (أو []Struct لو array) عبر json.Unmarshal
 * بدل map[string]interface{} العام.
 */
function buildGoEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `%s`);
  });
  const routeStr = pathParams.length > 0
    ? `fmt.Sprintf("${route}", ${pathParams.map(p => p.name).join(", ")})`
    : `"${route}"`;

  const bodyArg = endpoint.requestBody ? `body` : `nil`;
  const paramsArg = queryParams.length > 0 ? `params` : `nil`;

  lines.push(`// ${endpoint.summary}`);
  lines.push(`func (c *Client) ${fnName}(${args.join(", ")}) (${goReturnType}, error) {`);
  lines.push(`  data, err := c.doRequest(ctx, "${endpoint.method}", ${routeStr}, ${bodyArg}, ${paramsArg})`);
  lines.push(`  if err != nil {`);
  lines.push(`    var zero ${goReturnType}`);
  lines.push(`    return zero, err`);
  lines.push(`  }\n`);

  lines.push(`  var result ${goReturnType}`);
  lines.push(`  if err := json.Unmarshal(data, &result); err != nil {`);
  lines.push(`    var zero ${goReturnType}`);
  lines.push(`    return zero, &SDKError{Message: fmt.Sprintf("failed to parse response: %v", err), StatusCode: 0}`);
  lines.push(`  }`);
  lines.push(`  return result, nil`);
  lines.push(`}\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateGoEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildGoEndpointFn(endpoint, modelNames));
  });
  return lines;
}
