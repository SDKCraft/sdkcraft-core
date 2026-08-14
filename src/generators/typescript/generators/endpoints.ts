import { Endpoint } from "../../../parsers/openapi-parser";

/**
 * يبني method واحد (public) داخل كلاس Client لكل endpoint في الـ spec.
 * بيتعامل مع: path params, query params, request body, retry عبر this.request.
 * لو نوع الاستجابة هو model معروف عنده Zod schema (مفرد أو array)، بيتحقق من الاستجابة فعليًا
 * بالـ schema (runtime validation) بدل ما يثق بس بالـ type بتاع TypeScript وقت الـ compile.
 * لو الـ endpoint عنده callbacks (webhooks بترجع من الـ server نتيجة الطلب ده)، بيتوثقوا
 * كـ JSDoc @callback بدل ما يتفقدوا صامتين، ولو عنده links (HATEOAS)، بيتوثقوا كـ @see.
 */
function buildEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];

  const fnName = endpoint.operationId;
  const declaredPathParams = endpoint.parameters.filter(p => p.in === "path");
  const routeParamNames = Array.from(endpoint.route.matchAll(/\{([^}]+)\}/g)).map(m => m[1]);
  const missingParamNames = routeParamNames.filter(
    name => !declaredPathParams.some(p => p.name === name)
  );
  const pathParams = [
    ...declaredPathParams,
    ...missingParamNames.map(name => ({ name, in: "path", required: true, type: "string" })),
  ];
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "unknown";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = endpoint.responseModel !== null && modelNames.has(baseType);
  const returnType = rawType;

  const args: string[] = [];
  pathParams.forEach(p => args.push(`${p.name}: ${p.type === "integer" ? "number" : "string"}`));
  if (queryParams.length > 0) args.push(`params?: Record<string, string>`);
  if (endpoint.requestBodyModel) {
    args.push(`body?: ${endpoint.requestBodyModel}`);
  } else if (endpoint.requestBody) {
    args.push(`body?: Record<string, unknown>`);
  }

  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `\${${p.name}}`);
  });

  let callArgs: string;
  if (queryParams.length > 0 && endpoint.requestBody) {
    callArgs = `"${endpoint.method}", \`${route}\`, body, params`;
  } else if (queryParams.length > 0) {
    callArgs = `"${endpoint.method}", \`${route}\`, undefined, params`;
  } else if (endpoint.requestBody) {
    callArgs = `"${endpoint.method}", \`${route}\`, body as unknown as Record<string, unknown>`;
  } else {
    callArgs = `"${endpoint.method}", \`${route}\``;
  }

  lines.push(`  /**`);
  lines.push(`   * ${endpoint.summary}`);
  (endpoint.callbacks || []).forEach(cb => {
    lines.push(`   * @callback ${cb.route} (${cb.method}) — ${cb.summary || "server-initiated callback"}`);
  });
  (endpoint.links || []).forEach(link => {
    lines.push(`   * @see ${link.name}${link.operationId ? ` -> ${link.operationId}` : ""}${link.description ? `: ${link.description}` : ""}`);
  });
  lines.push(`   */`);
  lines.push(`  async ${fnName}(${args.join(", ")}): Promise<${returnType}> {`);

  if (hasSchema && isArray) {
    lines.push(`    const _result = await this.request<unknown>(${callArgs});`);
    lines.push(`    return z.array(${baseType}Schema).parse(_result) as ${returnType};`);
  } else if (hasSchema) {
    lines.push(`    const _result = await this.request<unknown>(${callArgs});`);
    lines.push(`    return ${baseType}Schema.parse(_result) as ${returnType};`);
  } else {
    lines.push(`    return this.request<${returnType}>(${callArgs});`);
  }

  lines.push(`  }\n`);

  return lines;
}

/**
 * يبني كل methods الـ endpoints مجتمعة.
 * modelNames: أسماء الـ models اللي عندها Zod schema مولّد، عشان نعرف نفعّل التحقق الفعلي منها وقت التشغيل.
 */
export function generateEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildEndpointFn(endpoint, modelNames));
  });
  return lines;
}
