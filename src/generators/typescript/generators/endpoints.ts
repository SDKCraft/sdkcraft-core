import { Endpoint, Model } from "../../../parsers/openapi-parser";

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
 * يبني async generator `iterate<OperationId>` لأي endpoint عنده pagination مكتشف فعلياً
 * (مش تخمين) من الـ parser: بيستخدم اسم الـ query param واسم حقل الـ response الحقيقيين
 * من الـ spec نفسه، بدل helper عام يفترض شكل واحد لكل الـ APIs.
 *
 * - cursor: بيتبع responseField (next_cursor مثلاً) لحد ما يرجع null/undefined
 * - page: بيزود رقم الصفحة لحد ما يرجع array فاضي (أو hasMore field لو موجود)
 * - offset: بيزود بمقدار limit لحد ما يرجع array فاضي (أو hasMore field لو موجود)
 */
function buildPaginationIterator(endpoint: Endpoint, models: Model[]): string[] {
  const { pagination, responseModel } = endpoint;
  if (!responseModel || pagination.style === "none") return [];

  const isArray = responseModel.endsWith("[]");
  let itemType: string | null = null;
  let unwrapPath: string | null = null; // اسم الحقل لو الرد object بيلف الـ array (زي .items)

  if (isArray) {
    itemType = responseModel.slice(0, -2);
  } else if (pagination.itemsField) {
    const model = models.find(m => m.name === responseModel);
    const field = model?.fields.find(f => f.name === pagination.itemsField);
    if (field && field.type.endsWith("[]")) {
      itemType = field.type.slice(0, -2);
      unwrapPath = pagination.itemsField;
    }
  }
  if (!itemType) return []; // ما قدرناش نتأكد من نوع العنصر بأمان، منولّدش iterator غلط

  const lines: string[] = [];
  const fnName = `iterate${endpoint.operationId.charAt(0).toUpperCase()}${endpoint.operationId.slice(1)}`;
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const routeParamNames = Array.from(endpoint.route.matchAll(/\{([^}]+)\}/g)).map(m => m[1]);
  const allPathParams = [
    ...pathParams,
    ...routeParamNames.filter(n => !pathParams.some(p => p.name === n)).map(n => ({ name: n, type: "string" })),
  ];
  const args: string[] = allPathParams.map(p => `${p.name}: ${(p as any).type === "integer" ? "number" : "string"}`);
  args.push(`params?: Record<string, string>`);

  const callArgNames = allPathParams.map(p => p.name).join(", ");
  const callArgs = callArgNames ? `${callArgNames}, _params` : `_params`;

  lines.push(`  /**`);
  lines.push(`   * يمشي على كل صفحات ${endpoint.operationId} تلقائيًا (${pagination.style}-based pagination) ويرجّع كل صفحة كـ array.`);
  lines.push(`   * الاستخدام: for await (const page of client.${fnName}(...)) { ... }`);
  lines.push(`   */`);
  lines.push(`  async *${fnName}(${args.join(", ")}): AsyncGenerator<${itemType}[]> {`);

  if (pagination.style === "cursor") {
    const param = pagination.requestParam || "cursor";
    lines.push(`    let _cursor: string | undefined = params?.["${param}"];`);
    lines.push(`    while (true) {`);
    lines.push(`      const _params: Record<string, string> = { ...(params || {}) };`);
    lines.push(`      if (_cursor !== undefined) _params["${param}"] = _cursor;`);
    lines.push(`      else delete _params["${param}"];`);
    lines.push(`      const _page = await this.${endpoint.operationId}(${callArgs});`);
    const itemsExpr = unwrapPath ? `_page.${unwrapPath}` : `_page`;
    lines.push(`      const _items = ${itemsExpr} as ${itemType}[];`);
    lines.push(`      if (!_items || _items.length === 0) break;`);
    lines.push(`      yield _items;`);
    if (pagination.responseField) {
      const respExpr = unwrapPath ? `(_page as any).${pagination.responseField}` : `(_page as any).${pagination.responseField}`;
      lines.push(`      const _next = ${respExpr};`);
      lines.push(`      if (!_next) break;`);
      lines.push(`      _cursor = _next;`);
    } else {
      lines.push(`      break; // ما فيش حقل واضح بالـ response يقول فيه صفحة جاية، فبنوقف بعد أول صفحة تفاديًا للف لا نهائي`);
    }
    lines.push(`    }`);
  } else if (pagination.style === "page" || pagination.style === "offset") {
    const param = pagination.requestParam || (pagination.style === "page" ? "page" : "offset");
    const startValue = pagination.style === "page" ? 1 : 0;
    const limitParam = pagination.limitParam;
    lines.push(`    let _cursor = Number(params?.["${param}"] ?? ${startValue});`);
    lines.push(`    while (true) {`);
    lines.push(`      const _params: Record<string, string> = { ...(params || {}), "${param}": String(_cursor) };`);
    lines.push(`      const _page = await this.${endpoint.operationId}(${callArgs});`);
    const itemsExpr = unwrapPath ? `_page.${unwrapPath}` : `_page`;
    lines.push(`      const _items = ${itemsExpr} as ${itemType}[];`);
    lines.push(`      if (!_items || _items.length === 0) break;`);
    lines.push(`      yield _items;`);
    if (pagination.responseField) {
      lines.push(`      if ((_page as any).${pagination.responseField} === false) break;`);
    }
    if (pagination.style === "page") {
      lines.push(`      _cursor++;`);
    } else if (limitParam) {
      lines.push(`      _cursor += Number(params?.["${limitParam}"] ?? _items.length);`);
    } else {
      lines.push(`      _cursor += _items.length;`);
    }
    lines.push(`    }`);
  }

  lines.push(`  }\n`);
  return lines;
}

/**
 * يبني كل methods الـ endpoints مجتمعة، وكمان iterator خاص لأي endpoint فيه pagination
 * مكتشف فعليًا من الـ spec (مش helper عام واحد بيفترض شكل موحد).
 * modelNames: أسماء الـ models اللي عندها Zod schema مولّد، عشان نعرف نفعّل التحقق الفعلي منها وقت التشغيل.
 * models: كل الموديلات، لازمة عشان نعرف نوع العنصر الحقيقي لو الـ response بيلف الـ array جوه حقل (زي .items).
 */
export function generateEndpoints(endpoints: Endpoint[], modelNames: Set<string>, models: Model[] = []): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildEndpointFn(endpoint, modelNames));
    lines.push(...buildPaginationIterator(endpoint, models));
  });
  return lines;
}