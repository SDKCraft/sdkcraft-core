import { Model, ModelField } from "../../../parsers/openapi-parser";

/**
 * يبني قيمة وهمية واحدة مناسبة لنوع الحقل، بالاعتماد على اسم الحقل لتخمين محتوى واقعي
 * (مثلاً "email" ترجع بريد وهمي بدل نص عشوائي).
 */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();
  if (field.type.endsWith("[]")) return `[]`;
  if (field.type === "unknown") return `undefined`;
  if (field.type === "string") {
    if (n.includes("email")) return `"user@example.com"`;
    if (n === "id" || n.endsWith("id")) return `"mock-id-" + Math.random().toString(36).slice(2, 10)`;
    if (n.includes("name")) return `"Sample Name"`;
    if (n.includes("url") || n.includes("link")) return `"https://example.com"`;
    if (n.includes("date") || n.includes("_at") || n.includes("time")) return `new Date().toISOString()`;
    return `"sample ${field.name}"`;
  }
  if (field.type === "integer") return `Math.floor(Math.random() * 100)`;
  if (field.type === "number") return `Math.round(Math.random() * 10000) / 100`;
  if (field.type === "boolean") return `Math.random() > 0.5`;
  // reference to another model
  return `build${field.type}()`;
}

/**
 * يبني دالة `buildX()` بترجع كائن وهمي واحد مطابق للـ interface X.
 */
function buildModelFactory(model: Model): string[] {
  const lines: string[] = [];
  lines.push(`function build${model.name}(): ${model.name} {`);
  lines.push(`  return {`);
  model.fields.forEach(field => {
    if (!field.required) return; // optional fields omitted by default for a lean mock
    lines.push(`    ${field.name}: ${fakeValueForField(field)},`);
  });
  lines.push(`  };`);
  lines.push(`}\n`);
  return lines;
}

/**
 * يحسب مجموعة أسماء الموديلات المستخدمة فعليًا كـ response في MockClient —
 * يبدأ من الموديلات اللي بترجع مباشرة من endpoint، وبعدين بيتتبع أي حقل
 * بيشاور على موديل تاني (nested model) بشكل متكرر (reachability)،
 * عشان منولّدش دوال build() لموديلات مالهاش أي استخدام فعلي (كود ميت).
 */
function computeUsedModelNames(models: Model[], endpoints: { responseModel?: string }[]): Set<string> {
  const modelByName = new Map(models.map(m => [m.name, m]));
  const used = new Set<string>();
  const queue: string[] = [];

  endpoints.forEach(e => {
    if (!e.responseModel) return;
    const baseType = e.responseModel.endsWith("[]") ? e.responseModel.slice(0, -2) : e.responseModel;
    if (modelByName.has(baseType)) queue.push(baseType);
  });

  while (queue.length > 0) {
    const name = queue.pop()!;
    if (used.has(name)) continue;
    used.add(name);
    const model = modelByName.get(name);
    if (!model) continue;
    model.fields.forEach(field => {
      if (!field.required) return; // buildModelFactory بيتجاهل الحقول الاختيارية أصلًا، فمفيش استدعاء ليها فعليًا
      const fieldBaseType = field.type.endsWith("[]") ? field.type.slice(0, -2) : field.type;
      if (modelByName.has(fieldBaseType) && !used.has(fieldBaseType)) {
        queue.push(fieldBaseType);
      }
    });
  }

  return used;
}

/**
 * يبني كل دوال build للـ models المستخدمة فعليًا بس (مش كل الـ models تلقائيًا)،
 * عشان نتجنب دوال build() ميتة (unused) بتفشل مع مشاريع فيها noUnusedLocals: true.
 */
export function generateMockFactories(models: Model[], endpoints: { responseModel?: string }[]): string[] {
  const usedNames = computeUsedModelNames(models, endpoints);
  const lines: string[] = [];
  models.forEach(model => {
    if (!usedNames.has(model.name)) return;
    lines.push(...buildModelFactory(model));
  });
  return lines;
}