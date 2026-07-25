import { Model } from "../../../parsers/openapi-parser";

/** يحوّل نوع الحقل من الـ parser لنوع Java مقابل (نوع كائن wrapper لدعم null) */
function toJavaType(type: string): string {
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemJavaType = itemType === "unknown" ? "Object" : toJavaType(itemType);
    return `java.util.List<${itemJavaType}>`;
  }
  switch (type) {
    case "string": return "String";
    case "number": return "Double";
    case "integer": return "Integer";
    case "boolean": return "Boolean";
    case "unknown": return "Object";
    default:
      // reference to another model
      return type;
  }
}

/**
 * يبني POJO واحد بـ Jackson: private fields + getters/setters + @JsonProperty
 * للحفاظ على الاسم الأصلي من الـ API (لأن convention جافا camelCase قد يختلف).
 */
function buildJavaClass(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`class ${model.name} {`);

  model.fields.forEach(field => {
    const javaType = toJavaType(field.type);
    lines.push(`  @JsonProperty("${field.name}")`);
    lines.push(`  private ${javaType} ${field.name};`);
  });
  lines.push(``);

  model.fields.forEach(field => {
    const javaType = toJavaType(field.type);
    const capitalized = field.name.charAt(0).toUpperCase() + field.name.slice(1);
    lines.push(`  public ${javaType} get${capitalized}() { return ${field.name}; }`);
    lines.push(`  public void set${capitalized}(${javaType} ${field.name}) { this.${field.name} = ${field.name}; }`);
  });

  lines.push(`}\n`);
  return lines;
}

/** يبني كل الموديلات مجتمعة */
export function generateJavaModels(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildJavaClass(model));
  });
  return lines;
}
