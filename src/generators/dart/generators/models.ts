import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع Dart مقابل */
function toDartType(type: string, nullable: boolean): string {
  let dartType: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemDartType = itemType === "unknown" ? "dynamic" : toDartType(itemType, false);
    dartType = `List<${itemDartType}>`;
  } else {
    switch (type) {
      case "string": dartType = "String"; break;
      case "number": dartType = "double"; break;
      case "integer": dartType = "int"; break;
      case "boolean": dartType = "bool"; break;
      case "unknown": dartType = "dynamic"; break;
      default:
        // reference to another model
        dartType = type;
    }
  }
  return nullable ? `${dartType}?` : dartType;
}

/**
 * يبني class واحد مع constructor + fromJson factory + toJson method.
 * هذا هو النمط القياسي في Dart لتحويل JSON (بدون مكتبة خارجية زي json_serializable،
 * عشان الـ SDK يفضل zero-dependency على مستوى الـ models).
 */
function buildDartClass(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`class ${model.name} {`);

  model.fields.forEach(field => {
    const dartType = toDartType(field.type, field.nullable || !field.required);
    lines.push(`  final ${dartType} ${field.name};`);
  });
  lines.push(``);

  const ctorArgs = model.fields.map(field => {
    const required = field.required ? "required " : "";
    return `${required}this.${field.name}`;
  }).join(", ");
  lines.push(`  ${model.name}({${ctorArgs}});\n`);

  lines.push(`  factory ${model.name}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${model.name}(`);
  model.fields.forEach(field => {
    const cast = field.type === "integer" ? " as int"
      : field.type === "number" ? " as double"
      : field.type === "boolean" ? " as bool"
      : " as String";
    const nullableCast = !field.required ? `${cast}?` : cast;
    lines.push(`      ${field.name}: json['${field.name}']${nullableCast},`);
  });
  lines.push(`    );`);
  lines.push(`  }\n`);

  lines.push(`  Map<String, dynamic> toJson() => {`);
  model.fields.forEach(field => {
    lines.push(`    '${field.name}': ${field.name},`);
  });
  lines.push(`  };`);
  lines.push(`}\n`);

  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateDartModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildDartClass(model));
  });
  return lines;
}
