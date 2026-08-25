import { Model, EnumModel, UnionModel } from "../../../parsers/openapi-parser";
/** يحوّل نوع الحقل من الـ parser لنوع Go مقابل */
function toGoType(type: string, nullable: boolean): string {
  let goType: string;
  if (type.startsWith(`"`) && type.endsWith(`"`)) {
    // discriminator literal (زي "credit_card") - Go معندهوش string literal types،
    // فبنستخدم string عادي؛ القيمة الفعلية بتتحط وقت الإنشاء في mock.ts
    goType = "string";
  } else if (type.endsWith("[]")) {
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
        // reference to another model/enum/union
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

/** يحوّل قيمة enum خام لاسم عضو const صالح ببايثون Go (PascalCase)، مع تفادي التصادم.
 *  مُصدَّرة عشان mock.ts يستخدم نفس منطق التسمية بالظبط لضمان تطابق الاسم 100%. */
export function buildGoEnumMemberNames(enumModel: EnumModel): string[] {
  const seen = new Set<string>();
  return enumModel.values.map(v => {
    let base = String(v)
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    if (!base || /^[0-9]/.test(base)) base = `Value${base}`;
    let unique = `${enumModel.name}${base}`;
    let i = 2;
    while (seen.has(unique)) {
      unique = `${enumModel.name}${base}${i}`;
      i++;
    }
    seen.add(unique);
    return unique;
  });
}

/**
 * يبني enum كـ named type + const block في Go (زي ما بتعمله معظم الـ generators،
 * لأن Go مفيهوش enum حقيقي). string -> `type X string`، integer -> `type X int`.
 */
function buildGoEnum(enumModel: EnumModel): string[] {
  const lines: string[] = [];
  const baseType = enumModel.baseType === "integer" ? "int" : "string";
  lines.push(`type ${enumModel.name} ${baseType}\n`);
  const memberNames = buildGoEnumMemberNames(enumModel);
  lines.push(`const (`);
  enumModel.values.forEach((v, i) => {
    const literal = enumModel.baseType === "integer" ? `${v}` : `"${v}"`;
    lines.push(`  ${memberNames[i]} ${enumModel.name} = ${literal}`);
  });
  lines.push(`)\n`);
  return lines;
}

/**
 * Go مفيهوش union types حقيقية. بنولّد type alias لـ interface{} عشان الحقول
 * المرتبطة بالunion تفضل قابلة للترجمة (compile) - الاستهلاك الفعلي محتاج type
 * assertion يدوي من طرف المستخدم. ده نفس الحل المستخدم لـ Java/C# لما مفيش
 * union types حقيقية باللغة.
 */
function buildGoUnion(unionModel: UnionModel): string[] {
  return [`// ${unionModel.name} can hold one of: ${unionModel.refs.join(", ")}`, `type ${unionModel.name} = interface{}\n`];
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

/** يبني كل التعريفات مجتمعة: enums أولاً، بعدين unions، وأخيرًا structs الموديلات */
export function generateGoModels(models: Model[], enums: EnumModel[] = [], unions: UnionModel[] = []): string[] {
  const lines: string[] = [];
  enums.forEach(e => lines.push(...buildGoEnum(e)));
  unions.forEach(u => lines.push(...buildGoUnion(u)));
  models.forEach(model => {
    lines.push(...buildGoStruct(model));
  });
  return lines;
}