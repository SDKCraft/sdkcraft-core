import { Model, EnumModel, UnionModel } from "../../../parsers/openapi-parser";

/**
 * يحوّل نوع الحقل من الـ parser (TypeScript-style) لنوع بايثون مقابل.
 * بيتعامل كمان مع:
 *  - discriminator literal مقتبس (زي "credit_card") -> Literal["credit_card"]
 *  - enum/union/model references -> اسم الكلاس/الـ type alias مباشرة (بيتحل lazy
 *    بفضل from __future__ import annotations + تأجيل pydantic الطبيعي لأي forward ref)
 */
function toPyType(type: string, nullable: boolean): string {
  let pyType: string;
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    const itemPyType = itemType === "unknown" ? "Any" : toPyType(itemType, false);
    pyType = `List[${itemPyType}]`;
  } else if (type.startsWith(`"`) && type.endsWith(`"`)) {
    pyType = `Literal[${type}]`;
  } else {
    switch (type) {
      case "string": pyType = "str"; break;
      case "number": pyType = "float"; break;
      case "integer": pyType = "int"; break;
      case "boolean": pyType = "bool"; break;
      case "unknown": pyType = "Any"; break;
      default:
        // reference to another model, enum, أو union
        pyType = type;
    }
  }
  return nullable ? `Optional[${pyType}]` : pyType;
}

/**
 * يحوّل قيمة enum خام لاسم عضو صالح ببايثون (UPPER_SNAKE_CASE)، مع تفادي التصادم
 * لو أكتر من قيمة بترجع لنفس الاسم بعد التطهير (بيضيف لاحقة رقمية).
 * مُصدَّرة (exported) عشان mock.ts يستخدم نفس منطق التسمية بالظبط لما يبني قيمة
 * وهمية بترجع لأول عضو enum — لازم الاسمين يتطابقوا 100%.
 */
export function buildPyEnumMemberNames(values: (string | number)[]): string[] {
  const seen = new Set<string>();
  return values.map(v => {
    let base = String(v).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!base || /^[0-9]/.test(base)) base = `VALUE_${base}`;
    let unique = base;
    let i = 2;
    while (seen.has(unique)) {
      unique = `${base}_${i}`;
      i++;
    }
    seen.add(unique);
    return unique;
  });
}

/** يبني كلاس Enum بايثون (str أو int حسب baseType) */
function buildPyEnumClass(enumModel: EnumModel): string[] {
  const lines: string[] = [];
  const base = enumModel.baseType === "integer" ? "int" : "str";
  const memberNames = buildPyEnumMemberNames(enumModel.values);
  lines.push(`class ${enumModel.name}(${base}, Enum):`);
  enumModel.values.forEach((v, i) => {
    const literal = enumModel.baseType === "integer" ? `${v}` : `"${v}"`;
    lines.push(`    ${memberNames[i]} = ${literal}`);
  });
  lines.push(``);
  return lines;
}

/**
 * يبني type alias لـ union: X = Union["A", "B"].
 * الـ refs متلفوفة بـ quotes (forward ref نصي) عمدًا عشان ترتيب التعريفات بالملف
 * الناتج ميهمش — pydantic بيحل أي forward ref بشكل lazy وقت أول استخدام فعلي
 * للموديل، مش وقت تعريف الـ alias نفسه (اللي بيتنفذ فورًا وقت الـ import).
 */
function buildPyUnion(unionModel: UnionModel): string[] {
  const refs = unionModel.refs.map(r => `"${r}"`).join(", ");
  return [`${unionModel.name} = Union[${refs}]`, ``];
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

/**
 * يبني كل التعريفات مجتمعة: enums أولاً (leaf types)، بعدين models، وأخيرًا unions
 * (كـ type aliases بترجع لموديلات/enums عبر forward refs نصية). الترتيب هنا تنظيمي
 * بس مش شرط صارم — راجع تعليق buildPyUnion.
 */
export function generatePyModels(models: Model[], enums: EnumModel[] = [], unions: UnionModel[] = []): string[] {
  if (models.length === 0 && enums.length === 0 && unions.length === 0) return [];
  const lines: string[] = [];
  enums.forEach(e => lines.push(...buildPyEnumClass(e)));
  models.forEach(model => lines.push(...buildPyModel(model)));
  unions.forEach(u => lines.push(...buildPyUnion(u)));
  return lines;
}
