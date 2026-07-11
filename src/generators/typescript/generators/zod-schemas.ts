import { Model } from "../../../parsers/openapi-parser";

/**
 * يحوّل نوع TypeScript إلى Zod schema مقابل
 */
function toZodType(type: string, nullable: boolean): string {
  let zodType: string;

  if (type.endsWith("[]")) {
    const innerType = type.slice(0, -2);
    zodType = `z.array(${toZodType(innerType, false)})`;
  } else {
    switch (type) {
      case "string":  zodType = "z.string()"; break;
      case "number":  zodType = "z.number()"; break;
      case "integer": zodType = "z.number().int()"; break;
      case "boolean": zodType = "z.boolean()"; break;
      case "unknown": zodType = "z.unknown()"; break;
      default:
        // reference to another model
        zodType = `${type}Schema`;
    }
  }

  return nullable ? `${zodType}.nullable()` : zodType;
}

/**
 * يبني Zod schema لـ model واحد
 */
function buildZodSchema(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`export const ${model.name}Schema = z.object({`);
  model.fields.forEach(field => {
    const zodType = toZodType(field.type, field.nullable ?? false);
    const optional = !field.required ? `.optional()` : "";
    lines.push(`  ${field.name}: ${zodType}${optional},`);
  });
  lines.push(`});\n`);
  lines.push(`export type ${model.name}Validated = z.infer<typeof ${model.name}Schema>;\n`);
  return lines;
}

/**
 * يبني قسم Zod schemas كامل
 */
export function generateZodSchemas(models: Model[]): string[] {
  if (models.length === 0) return [];
  const lines: string[] = [
    `// ---- Zod Schemas (Runtime Validation) ----\n`,
  ];
  models.forEach(model => {
    lines.push(...buildZodSchema(model));
  });
  return lines;
}
