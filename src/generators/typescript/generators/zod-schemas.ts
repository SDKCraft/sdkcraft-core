import { Model, EnumModel, UnionModel } from "../../../parsers/openapi-parser";

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
        // reference to another model/enum/union
        zodType = cyclicModelNames.has(type)
          ? `z.lazy(() => ${type}Schema)`
          : `${type}Schema`;
    }
  }

  return nullable ? `${zodType}.nullable()` : zodType;
}

/** يبني Zod schema لـ enum: z.enum([...]) للـ string، أو z.union(literals) للـ integer */
function buildZodEnumSchema(enumModel: EnumModel): string[] {
  if (enumModel.baseType === "integer") {
    const literals = enumModel.values.map(v => `z.literal(${v})`).join(", ");
    return [`export const ${enumModel.name}Schema = z.union([${literals}]);\n`];
  }
  const values = enumModel.values.map(v => `"${v}"`).join(", ");
  return [`export const ${enumModel.name}Schema = z.enum([${values}]);\n`];
}

/** يبني Zod schema لـ union (oneOf/anyOf): z.union([...]) من الـ schemas المرجعية،
 *  مع z.lazy() لأي ref جوه دورة اعتماد دائرية. */
function buildZodUnionSchema(unionModel: UnionModel, cyclicModelNames: Set<string>): string[] {
  const refs = unionModel.refs
    .map(r => (cyclicModelNames.has(r) ? `z.lazy(() => ${r}Schema)` : `${r}Schema`))
    .join(", ");
  return [`export const ${unionModel.name}Schema = z.union([${refs}]);\n`];
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

type SchemaNode =
  | { kind: "model"; name: string; deps: string[]; model: Model }
  | { kind: "union"; name: string; deps: string[]; union: UnionModel };

function getDirectModelDependencies(model: Model, allNames: Set<string>): string[] {
  const deps: string[] = [];
  for (const field of model.fields) {
    const base = field.type.endsWith("[]") ? field.type.slice(0, -2) : field.type;
    if (allNames.has(base) && base !== model.name && !deps.includes(base)) {
      deps.push(base);
    }
  }
  return deps;
}

/**
 * بيرتب models و unions مع بعض (Topological sort موحّد) بحيث أي نود يتعرّف
 * بعد كل اللي بيعتمد عليها - سواء الاعتماد ده من موديل لموديل، موديل ليunion،
 * أو union لموديل/union تاني. enums مستبعدة من الترتيب لأنها leaf nodes دايمًا
 * وبتتولّد أول حاجة قبل أي حاجة تانية.
 */
function topoSortSchemas(models: Model[], unions: UnionModel[], allNames: Set<string>): { ordered: SchemaNode[]; cyclic: Set<string> } {
  const nodes = new Map<string, SchemaNode>();
  models.forEach(m => nodes.set(m.name, { kind: "model", name: m.name, deps: getDirectModelDependencies(m, allNames), model: m }));
  unions.forEach(u => {
    const deps = u.refs.filter(r => allNames.has(r) && r !== u.name);
    nodes.set(u.name, { kind: "union", name: u.name, deps, union: u });
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cyclic = new Set<string>();
  const ordered: SchemaNode[] = [];

  function visit(name: string) {
    if (visited.has(name) || inStack.has(name)) {
      if (inStack.has(name)) cyclic.add(name);
      return;
    }
    const node = nodes.get(name);
    if (!node) return; // enum - مش جزء من الترتيب هنا
    inStack.add(name);
    for (const dep of node.deps) {
      visit(dep);
      if (inStack.has(dep)) cyclic.add(dep);
    }
    inStack.delete(name);
    visited.add(name);
    ordered.push(node);
  }

  for (const node of nodes.values()) visit(node.name);

  return { ordered, cyclic };
}

/**
 * يبني قسم Zod schemas كامل: enums أولاً (leaf nodes)، بعدين models و unions
 * سوا بترتيب topological موحّد (يحل مشكلة union بيرجع لموديل متعرّف بعده)،
 * مع z.lazy() تلقائي لأي دورة اعتماد دائرية.
 */
export function generateZodSchemas(models: Model[], enums: EnumModel[] = [], unions: UnionModel[] = []): string[] {
  if (models.length === 0 && enums.length === 0 && unions.length === 0) return [];

  const allNames = new Set([
    ...models.map(m => m.name),
    ...enums.map(e => e.name),
    ...unions.map(u => u.name),
  ]);
  const { ordered, cyclic } = topoSortSchemas(models, unions, allNames);

  const lines: string[] = [
    `// ---- Zod Schemas (Runtime Validation) ----\n`,
  ];
  enums.forEach(e => lines.push(...buildZodEnumSchema(e)));
  ordered.forEach(node => {
    if (node.kind === "model") lines.push(...buildZodSchema(node.model, cyclic));
    else lines.push(...buildZodUnionSchema(node.union, cyclic));
  });
  return lines;
}
