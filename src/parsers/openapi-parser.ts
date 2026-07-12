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

function extractModels(schemas: Record<string, any>): Model[] {
  const models: Model[] = [];
  for (const name in schemas) {
    const schema = schemas[name];
    if (schema.type === "object" || schema.properties) {
      const required: string[] = schema.required || [];
      const fields: ModelField[] = [];
      for (const fieldName in schema.properties || {}) {
        const prop = schema.properties[fieldName];
        fields.push({
          name: fieldName,
          type: openApiTypToTs(prop.type, prop.format),
          required: required.includes(fieldName),
          nullable: prop.nullable || false,
        });
      }
      models.push({ name, fields });
    }
  }
  return models;
}

function resolveRef(ref: string): string {
  return ref.replace("#/components/schemas/", "");
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
