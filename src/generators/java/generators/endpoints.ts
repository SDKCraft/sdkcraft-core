import { Endpoint } from "../../../parsers/openapi-parser";

/**
 * يبني تعبير الـ route كسلسلة Java صحيحة نحويًا، بتقسيم المسار لأجزاء ثابتة
 * ومتغيرات، وربطها بعلامات اقتباس صحيحة بدل استبدال نصي هش عرضة للأخطاء.
 * مثال: "/users/{id}" مع id كـ path param ترجع: "/users/" + id
 */
function buildRouteExpression(route: string, pathParams: { name: string }[]): string {
  if (pathParams.length === 0) return `"${route}"`;

  let result = route;
  const parts: string[] = [];
  let remaining = result;

  while (remaining.length > 0) {
    const match = pathParams
      .map(p => ({ p, idx: remaining.indexOf(`{${p.name}}`) }))
      .filter(x => x.idx !== -1)
      .sort((a, b) => a.idx - b.idx)[0];

    if (!match) {
      parts.push(`"${remaining}"`);
      break;
    }

    if (match.idx > 0) {
      parts.push(`"${remaining.slice(0, match.idx)}"`);
    }
    parts.push(match.p.name);
    remaining = remaining.slice(match.idx + `{${match.p.name}}`.length);
  }

  return parts.join(" + ");
}

/**
 * يبني method واحد داخل ApiClient لكل endpoint.
 * لو الاستجابة model معروف عنده POJO، بيحوّل الـ JSON فعليًا لكائن Java (mapper.readValue)
 * بدل ما يرجّع String خام يحتاج parsing يدوي من المستخدم.
 */
function buildJavaEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  const routeExpr = buildRouteExpression(endpoint.route, pathParams);

  const bodyArg = endpoint.requestBody ? `body` : `null`;
  const paramsArg = queryParams.length > 0 ? `params` : `null`;

  lines.push(`  /** ${endpoint.summary} */`);
  lines.push(`  public ${javaReturnType} ${fnName}(${args.join(", ")}) throws SDKException {`);
  lines.push(`    String _raw = request("${endpoint.method}", ${routeExpr}, ${bodyArg}, ${paramsArg});`);

  if (!hasSchema) {
    lines.push(`    return _raw;`);
  } else {
    lines.push(`    try {`);
    if (isArray) {
      lines.push(`      return mapper.readValue(_raw, new TypeReference<java.util.List<${baseType}>>() {});`);
    } else {
      lines.push(`      return mapper.readValue(_raw, ${baseType}.class);`);
    }
    lines.push(`    } catch (com.fasterxml.jackson.core.JsonProcessingException err) {`);
    lines.push(`      throw new SDKException("Failed to parse response: " + err.getMessage(), 0, _raw, false);`);
    lines.push(`    }`);
  }

  lines.push(`  }\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateJavaEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildJavaEndpointFn(endpoint, modelNames));
  });
  return lines;
}
