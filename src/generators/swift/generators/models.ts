import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع Swift مقابل */
function toSwiftType(type: string, nullable: boolean): string {
  const base = type === "number" ? "Double"
    : type === "boolean" ? "Bool"
    : type === "integer" ? "Int"
    : "String";
  return nullable ? `${base}?` : base;
}

/** يبني struct واحد مع Codable للتحويل التلقائي من/لـ JSON */
function buildSwiftStruct(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`struct ${model.name}: Codable {`);
  model.fields.forEach(field => {
    const type = toSwiftType(field.type, field.nullable || !field.required);
    lines.push(`  let ${field.name}: ${type}`);
  });
  lines.push(`}\n`);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateSwiftModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildSwiftStruct(model));
  });
  return lines;
}
