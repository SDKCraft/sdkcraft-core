/**
 * Fallback عام ساذج: يفترض إن السيرفر بياخد `page` رقمي وبيرجع array فاضي لما يخلص.
 * لو الـ endpoint عنده pagination مكتشف فعليًا من الـ spec (cursor/offset/page)، استخدم
 * الـ iterator المولّد خصيصًا ليه بدل هذا (اسمه `iterate<OperationId>` بالكلاينت) — أدق
 * وبيحترم اسم الـ param/response field الحقيقي بدل الافتراض العام هنا.
 */
export function generatePaginateFn(): string[] {
  const lines: string[] = [];

  lines.push(`/** Fetch all pages automatically */`);
  lines.push(`export async function paginate<T>(fn: (page: number) => Promise<T[]>, maxPages = 10): Promise<T[]> {`);
  lines.push(`  const results: T[] = [];`);
  lines.push(`  for (let page = 1; page <= maxPages; page++) {`);
  lines.push(`    const data = await fn(page);`);
  lines.push(`    if (!data || data.length === 0) break;`);
  lines.push(`    results.push(...data);`);
  lines.push(`  }`);
  lines.push(`  return results;`);
  lines.push(`}\n`);

  return lines;
}