import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع Kotlin مقابل */
function toKotlinType(type: string, nullable: boolean): string {
  let base: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemKtType = itemType === "unknown" ? "Any" : toKotlinType(itemType, false);
    base = `List<${itemKtType}>`;
  } else {
    switch (type) {
      case "number": base = "Double"; break;
      case "boolean": base = "Boolean"; break;
      case "integer": base = "Int"; break;
      case "string": base = "String"; break;
      case "unknown": base = "Any"; break;
      default:
        // reference to another model (كانت بتتحول غلط لـ String قبل كده لعدم وجود default branch)
        base = type;
    }
  }
  return nullable ? `${base}?` : base;
}

/**
 * يبني data class واحد مع @Serializable (kotlinx.serialization)،
 * عشان يقدر يتحوّل تلقائيًا من/لـ JSON بدون كود يدوي.
 */
function buildKtDataClass(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`@Serializable`);
  lines.push(`data class ${model.name}(`);
  model.fields.forEach((field, i) => {
    const type = toKotlinType(field.type, field.nullable || !field.required);
    const isOptional = !field.required;
    const defaultVal = isOptional ? " = null" : "";
    const comma = i < model.fields.length - 1 ? "," : "";
    lines.push(`  val ${field.name}: ${type}${defaultVal}${comma}`);
  });
  lines.push(`)\n`);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateKtModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildKtDataClass(model));
  });
  return lines;
}
