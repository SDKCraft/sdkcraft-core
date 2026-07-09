import { Endpoint } from "../../../parsers/openapi-parser";

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

/**
 * يبني method واحد داخل كلاس Client لكل endpoint.
 * لو الاستجابة model معروف عنده Pydantic class، بيتحقق منها فعليًا وقت التشغيل
 * عبر Model.model_validate(...)  (مفرد) أو list comprehension (array).
 */
function buildPyEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];

  const fnName = toSnakeCase(endpoint.operationId);
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);

  const args: string[] = ["self"];
  pathParams.forEach(p => args.push(safePyParamName(p.name)));
  if (queryParams.length > 0) args.push(`params: Optional[dict] = None`);
  if (endpoint.requestBody) args.push(`body: Optional[dict] = None`);

  // route بيستخدم اسم الـ path param الأصلي من الـ API (مش الاسم الآمن)،
  // فبنستبدل القيمة من المتغير الآمن جوه الـ f-string
  let route = endpoint.route;
  pathParams.forEach(p => {
    route = route.replace(`{${p.name}}`, `{${safePyParamName(p.name)}}`);
  });

  const callArgs: string[] = [`"${endpoint.method}"`, `f"${route}"`];
  if (endpoint.requestBody) callArgs.push(`body=body`);
  if (queryParams.length > 0) callArgs.push(`params=params`);

  lines.push(`    def ${fnName}(${args.join(", ")}):`);
  lines.push(`        """${endpoint.summary}"""`);
  lines.push(`        _result = self._request(${callArgs.join(", ")})`);

  if (hasSchema && isArray) {
    lines.push(`        return [${baseType}.model_validate(item) for item in _result]`);
  } else if (hasSchema) {
    lines.push(`        return ${baseType}.model_validate(_result)`);
  } else {
    lines.push(`        return _result`);
  }

  lines.push(``);
  return lines;
}

/** يبني كل methods الـ endpoints مجتمعة */
export function generatePyEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => {
    lines.push(...buildPyEndpointFn(endpoint, modelNames));
  });
  return lines;
}
