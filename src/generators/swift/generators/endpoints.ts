import { Endpoint } from "../../../parsers/openapi-parser";

/**
 * يبني func async واحدة داخل Client لكل endpoint.
 * الاستجابة بتتحوّل تلقائيًا لكائن typed عبر Codable/JSONDecoder في request<T>،
 * فمفيش حاجة لـ manual parsing هنا.
 */
function buildSwiftEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `\\(${p.name})`);
  });

  const paramsArg = queryParams.length > 0 ? `, params: params` : ``;

  lines.push(`  /// ${endpoint.summary}`);
  lines.push(`  func ${fnName}(${args.join(", ")}) async throws -> ${swiftReturnType} {`);

  if (endpoint.requestBody) {
    lines.push(`    let data = body.flatMap { try? JSONEncoder().encode($0) }`);
    lines.push(`    return try await request("${endpoint.method}", path: "${route}", body: data${paramsArg})`);
  } else {
    lines.push(`    return try await request("${endpoint.method}", path: "${route}"${paramsArg})`);
  }

  lines.push(`  }\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateSwiftEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildSwiftEndpointFn(endpoint, modelNames));
  });
  return lines;
}
