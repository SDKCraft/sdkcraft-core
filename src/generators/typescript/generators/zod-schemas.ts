import { Model } from "../../../parsers/openapi-parser";

/**
 * يحوّل نوع TypeScript إلى Zod schema مقابل.
 * لو النوع بيرجع لموديل جوه دورة اعتماد دائرية (circular reference)، بنلفه بـ
 * z.lazy(() => ...) عشان نتفادى مشكلة "used before declaration" حتى لو الترتيب
 * مش هيقدر يحلها (A بيعتمد على B و B بيعتمد على A مفيش ترتيب يرضي الاتنين).
 */
function toZodType(type: string, nullable: boolean, cyclicModelNames: Set<string>): string {
  let zodType: string;

  if (type.endsWith("[]")) {
    const innerType = type.slice(0, -2);
    zodType = `z.array(${toZodType(innerType, false, cyclicModelNames)})`;
  } else {
    switch (type) {
      case "string":  zodType = "z.string()"; break;
      case "number":  zodType = "z.number()"; break;
      case "integer": zodType = "z.number().int()"; break;
      case "boolean": zodType = "z.boolean()"; break;
      case "unknown": zodType = "z.unknown()"; break;
      default:
        // reference to another model
        zodType = cyclicModelNames.has(type)
          ? `z.lazy(() => ${type}Schema)`
          : `${type}Schema`;
    }
  }

  return nullable ? `${zodType}.nullable()` : zodType;
}

/**
 * يبني Zod schema لـ model واحد
 */
function buildZodSchema(model: Model, cyclicModelNames: Set<string>): string[] {
  const lines: string[] = [];
  lines.push(`export const ${model.name}Schema = z.object({`);
  model.fields.forEach(field => {
    const zodType = toZodType(field.type, field.nullable ?? false, cyclicModelNames);
    const optional = !field.required ? `.optional()` : "";
    lines.push(`  ${field.name}: ${zodType}${optional},`);
  });
  lines.push(`});\n`);
  lines.push(`export type ${model.name}Validated = z.infer<typeof ${model.name}Schema>;\n`);
  return lines;
}

/**
 * بيرجّع أسماء الموديلات التانية اللي موديل معين بيشير لها مباشرة (مش عن طريق array).
 */
function getDirectModelDependencies(model: Model, modelNames: Set<string>): string[] {
  const deps: string[] = [];
  for (const field of model.fields) {
    const base = field.type.endsWith("[]") ? field.type.slice(0, -2) : field.type;
    if (modelNames.has(base) && base !== model.name && !deps.includes(base)) {
      deps.push(base);
    }
  }
  return deps;
}

/**
 * بيرتب الموديلات بحيث أي موديل يتعرّف بعد كل الموديلات اللي هو بيعتمد عليها
 * (Topological sort)، عشان الـ const declarations متتنادوش قبل ما تتعرّف.
 * وبيرجع كمان مجموعة أسماء الموديلات المشتركة في أي دورة اعتماد دائرية
 * (circular dependency) عشان نستخدم z.lazy() ليها بدل الاعتماد على الترتيب وحده.
 */
function topoSortModels(models: Model[]): { ordered: Model[]; cyclic: Set<string> } {
  const modelNames = new Set(models.map(m => m.name));
  const byName = new Map(models.map(m => [m.name, m]));
  const dependencies = new Map(models.map(m => [m.name, getDirectModelDependencies(m, modelNames)]));

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cyclic = new Set<string>();
  const ordered: Model[] = [];

  function visit(name: string) {
    if (visited.has(name) || inStack.has(name)) {
      if (inStack.has(name)) cyclic.add(name); // back-edge -> دورة اعتماد دائرية
      return;
    }
    inStack.add(name);
    for (const dep of dependencies.get(name) || []) {
      visit(dep);
      if (inStack.has(dep)) cyclic.add(dep); // dep لسه جوه الـ stack يبقى فيه دورة تشمله
    }
    inStack.delete(name);
    visited.add(name);
    const model = byName.get(name);
    if (model) ordered.push(model);
  }

  for (const model of models) {
    visit(model.name);
  }

  return { ordered, cyclic };
}

/**
 * يبني قسم Zod schemas كامل، بترتيب يضمن إن أي موديل يتعرّف بعد كل الموديلات
 * اللي بيعتمد عليها (تفادي "used before declaration")، مع z.lazy() تلقائي
 * لأي دورة اعتماد دائرية.
 */
export function generateZodSchemas(models: Model[]): string[] {
  if (models.length === 0) return [];
  const { ordered, cyclic } = topoSortModels(models);
  const lines: string[] = [
    `// ---- Zod Schemas (Runtime Validation) ----\n`,
  ];
  ordered.forEach(model => {
    lines.push(...buildZodSchema(model, cyclic));
  });
  return lines;
}
