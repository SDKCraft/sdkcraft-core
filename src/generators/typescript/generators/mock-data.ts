import { Model, ModelField } from "../../../parsers/openapi-parser";

/**
 * يبني قيمة وهمية واحدة مناسبة لنوع الحقل، بالاعتماد على اسم الحقل لتخمين محتوى واقعي
 * (مثلاً "email" ترجع بريد وهمي بدل نص عشوائي).
 */
function fakeValueForField(field: ModelField): string {
  const n = field.name.toLowerCase();

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
 * يبني كل دوال build للـ models كلها.
 */
export function generateMockFactories(models: Model[]): string[] {
  const lines: string[] = [];
  models.forEach(model => {
    lines.push(...buildModelFactory(model));
  });
  return lines;
}
