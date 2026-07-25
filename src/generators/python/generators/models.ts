import { Model } from "../../../parsers/openapi-parser";

/**
 * يحوّل نوع الحقل من الـ parser (TypeScript-style) لنوع بايثون مقابل.
 */
function toPyType(type: string, nullable: boolean): string {
  let pyType: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemPyType = itemType === "unknown" ? "Any" : toPyType(itemType, false);
    pyType = `List[${itemPyType}]`;
  } else {
    switch (type) {
      case "string": pyType = "str"; break;
      case "number": pyType = "float"; break;
      case "integer": pyType = "int"; break;
      case "boolean": pyType = "bool"; break;
      case "unknown": pyType = "Any"; break;
      default:
        // reference to another model
        pyType = type;
    }
  }
  return nullable ? `Optional[${pyType}]` : pyType;
}

/**
 * يبني كلاس Pydantic واحد (BaseModel) لموديل واحد.
 * الحقول الاختيارية بتاخد Optional[...] = None، والحقول المطلوبة بتيجي فوق (بايثون بيرفض
 * default قبل حقل بدون default، فلازم نرتب: required أولًا ثم optional).
 */
function buildPyModel(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`class ${model.name}(BaseModel):`);

  const required = model.fields.filter(f => f.required);
  const optional = model.fields.filter(f => !f.required);

  if (model.fields.length === 0) {
    lines.push(`    pass`);
  }

  required.forEach(field => {
    lines.push(`    ${field.name}: ${toPyType(field.type, field.nullable)}`);
  });
  optional.forEach(field => {
    lines.push(`    ${field.name}: Optional[${toPyType(field.type, false)}] = None`);
  });

  lines.push(``);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generatePyModels(models: Model[]): string[] {
  if (models.length === 0) return [];
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildPyModel(model));
  });
  return lines;
}
