import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع C# مقابل (nullable حسب الحاجة) */
function toCsType(type: string, nullable: boolean): string {
  let csType: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemCsType = itemType === "unknown" ? "object" : toCsType(itemType, false);
    csType = `List<${itemCsType}>`;
  } else {
    switch (type) {
      case "string": csType = "string"; break;
      case "number": csType = "double"; break;
      case "integer": csType = "int"; break;
      case "boolean": csType = "bool"; break;
      case "unknown": csType = "object"; break;
      default:
        // reference to another model
        csType = type;
    }
  }
  return nullable ? `${csType}?` : csType;
}

/** يحوّل اسم الحقل لصيغة PascalCase (معيار خصائص C#) */
function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * يبني class واحد لموديل واحد مع [JsonPropertyName] للحفاظ على الاسم الأصلي
 * من الـ API (لأن خصائص C# لازم تبدأ بحرف كبير حسب الـ convention).
 */
function buildCsClass(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`public class ${model.name}`);
  lines.push(`{`);
  model.fields.forEach(field => {
    const csType = toCsType(field.type, field.nullable || !field.required);
    const propName = toPascalCase(field.name);
    lines.push(`    [JsonPropertyName("${field.name}")]`);
    lines.push(`    public ${csType} ${propName} { get; set; }${!field.required ? "" : ` = default!;`}`);
  });
  lines.push(`}\n`);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateCsModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildCsClass(model));
  });
  return lines;
}
