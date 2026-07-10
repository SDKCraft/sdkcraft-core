import { Endpoint } from "../../../parsers/openapi-parser";

/** يحوّل operationId لصيغة camelCase (اسم method في Dart) */
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * يبني method واحد داخل Client لكل endpoint.
 * path params بتيجي positional (مطلوبة)، وquery/body بتيجي named optional داخل {}
 * (قاعدة أساسية في Dart: مينفعش تخلط positional بعد named في نفس القوس).
 * لو الاستجابة model معروف، بيحوّل الـ JSON فعليًا لكائن Dart عبر Model.fromJson
 * (مفرد) أو map + fromJson (array)، بدل ما يرجّع dynamic خام.
 */
function buildDartEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `\${${p.name}}`);
  });

  const hasQuery = queryParams.length > 0;
  const hasBody = !!endpoint.requestBody;
  let callExpr: string;
  if (hasQuery && hasBody) {
    callExpr = `_request('${endpoint.method}', '${route}', body: body, params: params)`;
  } else if (hasQuery) {
    callExpr = `_request('${endpoint.method}', '${route}', params: params)`;
  } else if (hasBody) {
    callExpr = `_request('${endpoint.method}', '${route}', body: body)`;
  } else {
    callExpr = `_request('${endpoint.method}', '${route}')`;
  }

  lines.push(`  /// ${endpoint.summary}`);
  lines.push(`  Future<${dartReturnType}> ${fnName}(${allArgs.join(", ")}) async {`);
  lines.push(`    final result = await ${callExpr};`);

  if (!hasSchema) {
    lines.push(`    return result;`);
  } else if (isArray) {
    lines.push(`    return (result as List).map((e) => ${baseType}.fromJson(e as Map<String, dynamic>)).toList();`);
  } else {
    lines.push(`    return ${baseType}.fromJson(result as Map<String, dynamic>);`);
  }

  lines.push(`  }\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateDartEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildDartEndpointFn(endpoint, modelNames));
  });
  return lines;
}
