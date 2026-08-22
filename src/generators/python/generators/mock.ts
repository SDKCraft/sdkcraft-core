import { Model, ModelField, Endpoint, EnumModel, UnionModel } from "../../../parsers/openapi-parser";
import { buildPyEnumMemberNames } from "./models";

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

/** يبني مرجع أول عضو enum (زي PaymentMethod.CREDIT_CARD) للاستخدام كقيمة mock —
 *  بيستخدم نفس دالة التسمية اللي بتستخدمها models.ts لضمان تطابق الاسم 100%. */
function firstEnumMemberRef(enumModel: EnumModel): string {
  const memberNames = buildPyEnumMemberNames(enumModel.values);
  return `${enumModel.name}.${memberNames[0]}`;
}

/** يبني قيمة وهمية واحدة مناسبة لنوع ومحتوى الحقل */
function fakeValueForField(
  field: ModelField,
  enumByName: Map<string, EnumModel>,
  unionByName: Map<string, UnionModel>
): string {
  const n = field.name.toLowerCase();

  if (field.type.endsWith("[]")) {
    const itemType = field.type.slice(0, -2);
    if (itemType === "string" || itemType === "integer" || itemType === "number" || itemType === "boolean" || itemType === "unknown") {
      return `[]`;
    }
    const itemEnumModel = enumByName.get(itemType);
    if (itemEnumModel) return `[${firstEnumMemberRef(itemEnumModel)}]`;
    const itemUnionModel = unionByName.get(itemType);
    if (itemUnionModel && itemUnionModel.refs.length > 0) {
      return `[${fakeValueForField({ ...field, type: itemUnionModel.refs[0] }, enumByName, unionByName)}]`;
    }
    // array of a nested model - نبني عنصر واحد كعينة عشان الـ mock يفضل واقعي وخفيف
    return `[_build_${toSnakeCase(itemType)}()]`;
  }
  if (field.type === "unknown") return `None`;

  if (field.type.startsWith(`"`) && field.type.endsWith(`"`)) {
    // discriminator literal field (زي "credit_card") - القيمة الوهمية هي نفس النص الحرفي
    return field.type;
  }

  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-" + str(uuid.uuid4())[:8]`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `datetime.utcnow().isoformat()`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `random.randint(1, 100)`;
  if (field.type === "number") return `round(random.uniform(1, 1000), 2)`;
  if (field.type === "boolean") return `random.choice([True, False])`;

  const enumModel = enumByName.get(field.type);
  if (enumModel) return firstEnumMemberRef(enumModel);

  const unionModel = unionByName.get(field.type);
  if (unionModel && unionModel.refs.length > 0) {
    return fakeValueForField({ ...field, type: unionModel.refs[0] }, enumByName, unionByName);
  }

  return `_build_${toSnakeCase(field.type)}()`;
}

/** يبني دالة `_build_x()` بترجع نسخة وهمية من موديل واحد */
function buildPyMockFactory(
  model: Model,
  enumByName: Map<string, EnumModel>,
  unionByName: Map<string, UnionModel>
): string[] {
  const lines: string[] = [];
  const fnName = `_build_${toSnakeCase(model.name)}`;
  lines.push(`def ${fnName}():`);
  lines.push(`    return ${model.name}(`);
  model.fields.filter(f => f.required).forEach(field => {
    lines.push(`        ${field.name}=${fakeValueForField(field, enumByName, unionByName)},`);
  });
  lines.push(`    )`);
  lines.push(``);
  return lines;
}

/** يبني كل دوال build للـ models. بعكس TypeScript، بايثون مالوش noUnusedLocals،
 *  فمفيش داعي لتتبع "الموديلات المستخدمة فعليًا" - بنولّد دالة build لكل موديل. */
export function generatePyMockFactories(
  models: Model[],
  enums: EnumModel[] = [],
  unions: UnionModel[] = []
): string[] {
  const enumByName = new Map(enums.map(e => [e.name, e]));
  const unionByName = new Map(unions.map(u => [u.name, u]));
  const lines: string[] = [];
  models.forEach(model => lines.push(...buildPyMockFactory(model, enumByName, unionByName)));
  return lines;
}

/** يبني imports إضافية مطلوبة للـ mock (uuid, random, datetime) */
export function generatePyMockImports(): string[] {
  return [`import random`, `import uuid`, `from datetime import datetime`, ``];
}

/** فتح كلاس MockClient */
export function generatePyMockClientOpen(): string[] {
  const lines: string[] = [];
  lines.push(`class MockClient:`);
  lines.push(`    """Same interface as Client, but returns realistic fake data instead of calling the network."""`);
  lines.push(``);
  lines.push(`    def __init__(self, latency: float = 0.2):`);
  lines.push(`        self.latency = latency`);
  lines.push(``);
  return lines;
}

/**
 * يبني method واحد داخل MockClient (نفس توقيع الميثود المقابل في Client، بما فيه أسماء الباراميترات الآمنة).
 * modelNames: نفس مجموعة أسماء الموديلات المعروفة المستخدمة في endpoints.ts — لازم نتحقق منها هنا
 * كمان قبل استدعاء _build_X()، وإلا هيتولد استدعاء لدالة غير موجودة لو baseType مش موديل حقيقي.
 */
function buildPyMockEndpointFn(endpoint: Endpoint, modelNames: Set<string>): string[] {
  const lines: string[] = [];
  const fnName = toSnakeCase(endpoint.operationId);
  const pathParams = endpoint.parameters.filter(p => p.in === "path");
  const queryParams = endpoint.parameters.filter(p => p.in === "query");

  const rawType = endpoint.responseModel || "";
  const isArray = rawType.endsWith("[]");
  const baseType = isArray ? rawType.slice(0, -2) : rawType;
  const hasSchema = rawType !== "" && modelNames.has(baseType);
  const factoryName = `_build_${toSnakeCase(baseType)}`;

  const args: string[] = ["self"];
  pathParams.forEach(p => args.push(safePyParamName(p.name)));
  if (queryParams.length > 0) args.push(`params: Optional[dict] = None`);
  if (endpoint.requestBody) args.push(`body: Optional[dict] = None`);

  lines.push(`    def ${fnName}(${args.join(", ")}):`);
  lines.push(`        """${endpoint.summary} (mock)"""`);
  lines.push(`        time.sleep(self.latency)`);

  if (!hasSchema) {
    lines.push(`        return None`);
  } else if (isArray) {
    lines.push(`        return [${factoryName}(), ${factoryName}(), ${factoryName}()]`);
  } else {
    lines.push(`        return ${factoryName}()`);
  }

  lines.push(``);
  return lines;
}

/** يبني كل methods الـ MockClient */
export function generatePyMockEndpoints(endpoints: Endpoint[], modelNames: Set<string>): string[] {
  const lines: string[] = [];
  endpoints.forEach(endpoint => lines.push(...buildPyMockEndpointFn(endpoint, modelNames)));
  return lines;
}
