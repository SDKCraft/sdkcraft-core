import { Model, EnumModel, UnionModel } from "../../../parsers/openapi-parser";
/**
 * يحوّل قائمة Models إلى TypeScript interfaces.
 */
function buildModelInterface(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`export interface ${model.name} {`);
  model.fields.forEach(field => {
    const optional = !field.required ? "?" : "";
    const nullable = field.nullable ? " | null" : "";
    lines.push(`  ${field.name}${optional}: ${field.type}${nullable};`);
  });
  lines.push(`}\n`);
  return lines;
}

/** يحوّل enum إلى TypeScript union type من string/number literals */
function buildEnumType(enumModel: EnumModel): string[] {
  const literals = enumModel.values
    .map(v => (enumModel.baseType === "integer" ? v : `"${v}"`))
    .join(" | ");
  return [`export type ${enumModel.name} = ${literals};\n`];
}

/** يحوّل union (oneOf/anyOf) إلى TypeScript union type من الموديلات المرجعية */
function buildUnionType(unionModel: UnionModel): string[] {
  return [`export type ${unionModel.name} = ${unionModel.refs.join(" | ")};\n`];
}

/**
 * يبني قسم الـ Models كامل، بما فيه enums و unions، بترتيب enums -> unions -> models
 * (عشان أي موديل بيعتمد عليهم يلاقيهم متعرّفين قبله في الكود الناتج).
 */
export function generateModels(models: Model[], enums: EnumModel[] = [], unions: UnionModel[] = []): string[] {
  if (models.length === 0 && enums.length === 0 && unions.length === 0) return [];
  const lines: string[] = [`// ---- Models ----\n`];
  enums.forEach(e => lines.push(...buildEnumType(e)));
  unions.forEach(u => lines.push(...buildUnionType(u)));
  models.forEach(model => {
    lines.push(...buildModelInterface(model));
  });
  return lines;
}
