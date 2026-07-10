import { Endpoint } from "../../../parsers/openapi-parser";

/**
 * يبني suspend fun واحدة داخل Client لكل endpoint.
 * لو الاستجابة model معروف عنده @Serializable class، بيحوّل الـ JSON فعليًا لكائن Kotlin
 * عبر json.decodeFromString بدل ما يرجّع String خام أو cast غير صالح (`as Type`).
 */
function buildKtEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `\${${p.name}}`);
  });

  const bodyArg = endpoint.requestBody ? `body` : `null`;
  const paramsArg = queryParams.length > 0 ? `params` : `null`;

  lines.push(`  /** ${endpoint.summary} */`);
  lines.push(`  suspend fun ${fnName}(${args.join(", ")}): ${ktReturnType} {`);
  lines.push(`    val raw = request("${endpoint.method}", "${route}", ${bodyArg}, ${paramsArg})`);

  if (!hasSchema) {
    lines.push(`    return raw`);
  } else if (isArray) {
    lines.push(`    return json.decodeFromString<List<${baseType}>>(raw)`);
  } else {
    lines.push(`    return json.decodeFromString<${baseType}>(raw)`);
  }

  lines.push(`  }\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateKtEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildKtEndpointFn(endpoint, modelNames));
  });
  return lines;
}
