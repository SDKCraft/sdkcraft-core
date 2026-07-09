import { Endpoint } from "../../../parsers/openapi-parser";

/** يحوّل operationId لصيغة PascalCase (اسم method مصدَّر في C#) */
function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * يبني method واحد async داخل Client لكل endpoint.
 * لو الاستجابة model معروف، بيحوّل الـ JSON فعليًا لكائن C# عبر JsonSerializer.Deserialize
 * بدل ما يرجّع string خام يحتاج parsing يدوي من المستخدم.
 */
function buildCsEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
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

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `{${p.name}}`);
  });
  const routeStr = pathParams.length > 0 ? `$"${route}"` : `"${route}"`;

  const bodyArg = endpoint.requestBody ? `body` : `null`;
  const paramsArg = queryParams.length > 0 ? `queryParams` : `null`;

  lines.push(`    /// <summary>${endpoint.summary}</summary>`);
  lines.push(`    public async Task<${csReturnType}> ${fnName}(${args.join(", ")})`);
  lines.push(`    {`);
  lines.push(`        var raw = await RequestAsync("${endpoint.method}", ${routeStr}, ${bodyArg}, ${paramsArg});`);

  if (!hasSchema) {
    lines.push(`        return raw;`);
  } else {
    lines.push(`        try`);
    lines.push(`        {`);
    lines.push(`            return JsonSerializer.Deserialize<${csReturnType}>(raw) ?? throw new SDKException("Empty response", 0, raw, false);`);
    lines.push(`        }`);
    lines.push(`        catch (JsonException err)`);
    lines.push(`        {`);
    lines.push(`            throw new SDKException($"Failed to parse response: {err.Message}", 0, raw, false);`);
    lines.push(`        }`);
  }

  lines.push(`    }\n`);

  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generateCsEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildCsEndpointFn(endpoint, modelNames));
  });
  return lines;
}
