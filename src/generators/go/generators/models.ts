import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع Go مقابل */
function toGoType(type: string, nullable: boolean): string {
  let goType: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    // نبني نوع السلايس من نوع العنصر بدون تكرار الـ pointer syntax جوه الـ []
    const itemGoType = itemType === "unknown" ? "interface{}" : toGoType(itemType, false);
    goType = `[]${itemGoType}`;
  } else {
    switch (type) {
      case "string": goType = "string"; break;
      case "number": goType = "float64"; break;
      case "integer": goType = "int"; break;
      case "boolean": goType = "bool"; break;
      case "unknown": goType = "interface{}"; break;
      default:
        // reference to another model
        goType = type;
    }
  }
  // في Go، بنستخدم pointer للحقول nullable/optional عشان نميّز absence عن zero value
  return nullable ? `*${goType}` : goType;
}

/** يحوّل اسم الحقل لصيغة PascalCase (المطلوبة لتصدير الحقل من الـ struct في Go) */
function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * يبني struct واحد لموديل واحد، مع JSON tag يحافظ على الاسم الأصلي من الـ API
 * (لأن حقول Go المصدَّرة لازم تبدأ بحرف كبير، لكن الـ JSON من السيرفر ممكن يكون camelCase).
 */
function buildGoStruct(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`type ${model.name} struct {`);
  model.fields.forEach(field => {
    const goType = toGoType(field.type, field.nullable || !field.required);
    const fieldName = toPascalCase(field.name === "id" ? "ID" : field.name);
    const omitempty = !field.required ? ",omitempty" : "";
    lines.push(`  ${fieldName} ${goType} \`json:"${field.name}${omitempty}"\``);
  });
  lines.push(`}\n`);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateGoModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildGoStruct(model));
  });
  return lines;
}
