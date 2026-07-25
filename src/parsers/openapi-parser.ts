import fs from "fs";
import yaml from "js-yaml";

export interface Parameter {
  name: string;
  in: string;
  required: boolean;
  type: string;
}

export interface ModelField {
  name: string;
  type: string;
  required: boolean;
  nullable: boolean;
}

export interface Model {
  name: string;
  fields: ModelField[];
}

export interface Endpoint {
  method: string;
  route: string;
  operationId: string;
  summary: string;
  parameters: Parameter[];
  requestBody: string | null;
  requestBodyModel: string | null;
  responseModel: string | null;
  responses: string[];
}

export interface ApiSpec {
  title: string;
  version: string;
  baseUrl: string;
  endpoints: Endpoint[];
  models: Model[];
}

function openApiTypToTs(type: string, format?: string): string {
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "array") return "unknown[]";
  return "string";
}

function resolveRef(ref: string): string {
  return ref.replace("#/components/schemas/", "");
}

function toPascalCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * بيبني اسم موديل جديد (synthetic) لأي inline object مفيهوش $ref، بالاعتماد على
 * اسم الموديل الأب + اسم الحقل (مثلاً Product + dimensions => ProductDimensions).
 */
function synthesizeModelName(parentModelName: string, fieldName: string): string {
  return `${parentModelName}${toPascalCase(fieldName)}`;
}

/**
 * يحل نوع الحقل (property) لاسم الموديل أو النوع البدائي الصحيح.
 * بيتعامل مع:
 *  - $ref مباشر على موديل تاني (e.g. financialMetrics: $ref PriceMatrix)
 *  - allOf بيحتوي على $ref واحد على الأقل (composition pattern شائع لجعل الحقل موسّع)
 *  - array بعناصرها $ref أو inline object أو عناصر بدائية (string[]/number[]...)
 *  - inline object (زي "dimensions") بمافيهوش $ref خالص - بنولّد له موديل جديد
 *    باسم مشتق (synthesized) بدل ما نرجعه "string" غلط
 *  - الأنواع البدائية العادية (fallback عبر openApiTypToTs)
 *
 * models: المصفوفة المشتركة اللي بيتم الدفع فيها بأي موديل جديد (بما فيها الـ
 * synthetic) بمجرد ما يخلص بناؤه بالكامل - وده بيضمن إن أي موديل متعرّف في
 * المصفوفة قبل أي موديل تاني بيعتمد عليه (ترتيب صحيح حتى للغات زي Python
 * اللي محتاجة الكلاس يتعرّف قبل ما يتستخدم كنوع لحقل).
 */
function resolvePropertyType(
  prop: any,
  context: { parentModelName: string; fieldName: string },
  schemas: Record<string, any>,
  models: Model[]
): string {
  if (!prop) return "string";

  if (prop.$ref) {
    return resolveRef(prop.$ref);
  }

  if (Array.isArray(prop.allOf)) {
    const refEntry = prop.allOf.find((s: any) => s && s.$ref);
    if (refEntry) return resolveRef(refEntry.$ref);
    return "unknown";
  }

  if (prop.type === "array") {
    if (prop.items?.$ref) return `${resolveRef(prop.items.$ref)}[]`;
    if (prop.items?.allOf) {
      const refEntry = prop.items.allOf.find((s: any) => s && s.$ref);
      if (refEntry) return `${resolveRef(refEntry.$ref)}[]`;
    }
    if (prop.items?.type === "object" && prop.items.properties) {
      const syntheticName = synthesizeModelName(context.parentModelName, context.fieldName);
      buildAndRegisterModel(syntheticName, prop.items, schemas, models);
      return `${syntheticName}[]`;
    }
    if (prop.items?.type && prop.items.type !== "array") {
      return `${openApiTypToTs(prop.items.type, prop.items.format)}[]`;
    }
    return "unknown[]";
  }

  if (prop.type === "object" && prop.properties) {
    const syntheticName = synthesizeModelName(context.parentModelName, context.fieldName);
    buildAndRegisterModel(syntheticName, prop, schemas, models);
    return syntheticName;
  }

  return openApiTypToTs(prop.type, prop.format);
}

/**
 * بيجمع properties و required فيلدز لموديل واحد، وبيحل الـ allOf على مستوى
 * الموديل نفسه (model composition) بدمج كل فروع allOf (كل فرع ممكن يكون $ref
 * لموديل تاني أو schema inline). ده بيحل مشكلة "موديلات allOf كانت بتتفقد بالكامل"
 * لأن الكود القديم كان بيشترط schema.properties موجودة مباشرة فقط.
 */
function collectSchemaProperties(
  schema: any,
  schemas: Record<string, any>,
  seen: Set<string> = new Set()
): { properties: Record<string, any>; required: string[] } {
  let properties: Record<string, any> = {};
  let required: string[] = [];

  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      if (!branch) continue;
      if (branch.$ref) {
        const refName = resolveRef(branch.$ref);
        if (seen.has(refName)) continue;
        const refSchema = schemas[refName];
        if (refSchema) {
          const nested = collectSchemaProperties(refSchema, schemas, new Set([...seen, refName]));
          properties = { ...properties, ...nested.properties };
          required = [...required, ...nested.required];
        }
      } else {
        const nested = collectSchemaProperties(branch, schemas, seen);
        properties = { ...properties, ...nested.properties };
        required = [...required, ...nested.required];
      }
    }
  }

  if (schema.properties) {
    properties = { ...properties, ...schema.properties };
  }
  if (Array.isArray(schema.required)) {
    required = [...required, ...schema.required];
  }

  return { properties, required };
}

/**
 * بيبني موديل واحد بالكامل (فيلدز + أي نماذج نستد جواه) ويدفعه في المصفوفة
 * المشتركة `models` بعد ما يخلص - يعني أي موديل فرعي (synthetic) بيتولّد أثناء
 * حل حقل معين هيتدفع في المصفوفة قبل الموديل الأب اللي بيستخدمه، فيضمن ترتيب
 * الاعتماد صحيح تلقائيًا (child قبل parent).
 */
function buildAndRegisterModel(
  name: string,
  schema: any,
  schemas: Record<string, any>,
  models: Model[]
): void {
  if (models.some(m => m.name === name)) return; // تفادي تكرار نفس الموديل لو اتولّد قبل كده
  const { properties, required } = collectSchemaProperties(schema, schemas);
  const fields: ModelField[] = [];
  for (const fieldName in properties) {
    const prop = properties[fieldName];
    fields.push({
      name: fieldName,
      type: resolvePropertyType(prop, { parentModelName: name, fieldName }, schemas, models),
      required: required.includes(fieldName),
      nullable: prop.nullable || false,
    });
  }
  models.push({ name, fields });
}

function extractModels(schemas: Record<string, any>): Model[] {
  const models: Model[] = [];
  for (const name in schemas) {
    if (models.some(m => m.name === name)) continue; // ممكن يكون اتبنى بالفعل كـ dependency لموديل سابق
    const schema = schemas[name];
    const isObjectLike = schema.type === "object" || !!schema.properties || Array.isArray(schema.allOf);
    if (isObjectLike) {
      buildAndRegisterModel(name, schema, schemas, models);
    }
  }
  return models;
}

function toPascalSegment(segment: string): string {
  return segment
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * يبني operationId احتياطي آمن (صالح كاسم دالة/متغير في أي لغة برمجة) لما الـ spec
 * ما يحددش operationId صراحةً. بيشيل الأقواس المتعرجة {} والشرطات المائلة /،
 * ويحوّل path params لصيغة "ById" بدل ما تفضل حرفية زي "{id}" في اسم الدالة.
 * مثال: GET /products/{id} -> "getProductsById"
 */
function buildFallbackOperationId(method: string, route: string): string {
  const segments = route.split("/").filter(Boolean);
  const nameParts = segments.map(seg => {
    const paramMatch = seg.match(/^\{(.+)\}$/);
    if (paramMatch) {
      return "By" + toPascalSegment(paramMatch[1]);
    }
    return toPascalSegment(seg);
  });
  const combined = nameParts.join("");
  const withMethod = method.toLowerCase() + combined;
  // fallback نهائي لو الـ route فاضي تمامًا (نادر جدًا)
  return combined.length > 0 ? withMethod : method.toLowerCase() + "Root";
}

export function parseOpenApi(filePath: string): ApiSpec {
  const rawData = fs.readFileSync(filePath, "utf-8");
  const spec = filePath.endsWith(".yaml") || filePath.endsWith(".yml")
    ? yaml.load(rawData) as any
    : JSON.parse(rawData);

  const schemas = spec.components?.schemas || {};
  const models = extractModels(schemas);
  const endpoints: Endpoint[] = [];
  const paths = spec.paths || {};

  for (const route in paths) {
    const validMethods = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];
    for (const method in paths[route]) {
      if (!validMethods.includes(method.toLowerCase())) continue;
      const op = paths[route][method];
      const pathLevelParams = paths[route].parameters || [];
      const parameters: Parameter[] = [...pathLevelParams, ...(op.parameters || [])].map((p: any) => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        type: p.schema?.type || "string",
      }));

      const responses = Object.keys(op.responses || {});

      const requestBody = op.requestBody
        ? JSON.stringify(op.requestBody?.content)
        : null;

      // استخرج اسم الـ model من requestBody
      let requestBodyModel: string | null = null;
      const rbRef = op.requestBody?.content?.["application/json"]?.schema?.$ref;
      if (rbRef) requestBodyModel = resolveRef(rbRef);

      // استخرج اسم الـ model من response
      let responseModel: string | null = null;
      const successResponse = op.responses?.["200"] || op.responses?.["201"];
      const resRef = successResponse?.content?.["application/json"]?.schema?.$ref;
      const resArrayRef = successResponse?.content?.["application/json"]?.schema?.items?.$ref;
      if (resRef) responseModel = resolveRef(resRef);
      else if (resArrayRef) responseModel = resolveRef(resArrayRef) + "[]";

      endpoints.push({
        method: method.toUpperCase(),
        route,
        operationId: op.operationId || buildFallbackOperationId(method, route),
        summary: op.summary || "",
        parameters,
        requestBody,
        requestBodyModel,
        responseModel,
        responses,
      });
    }
  }

  return {
    title: spec.info?.title || "Unknown API",
    version: spec.info?.version || "1.0.0",
    baseUrl: spec.servers?.[0]?.url || "",
    endpoints,
    models,
  };
}
