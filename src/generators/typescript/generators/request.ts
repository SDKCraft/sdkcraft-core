/**
 * يبني دالة `request<T>` الداخلية المسؤولة عن:
 * - بناء الـ URL النهائي (مع query params)
 * - إرفاق هيدرز المصادقة (API Key / Bearer Token)
 * - timeout عبر AbortController
 * - إعادة المحاولة (retry) فقط على GET + (429 أو 5xx أو خطأ شبكة) — مش على أخطاء 4xx العادية
 * - رمي SDKError مع status/body بدل Error عام
 *
 * هذه الدالة private (مش exported) — بتُستخدم داخليًا فقط من دوال الـ endpoints.
 */
export function generateRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`async function sleep(ms: number): Promise<void> {`);
  lines.push(`  return new Promise(resolve => setTimeout(resolve, ms));`);
  lines.push(`}\n`);

  lines.push(`async function parseErrorBody(res: Response): Promise<unknown> {`);
  lines.push(`  try { return await res.json(); } catch { return undefined; }`);
  lines.push(`}\n`);

  lines.push(`async function request<T>(method: string, path: string, body?: Record<string, unknown>, params?: Record<string, string>, retries = 3, timeoutMs = 30000): Promise<T> {`);
  lines.push(`  let url = BASE_URL + path;`);
  lines.push(`  if (params) {`);
  lines.push(`    const query = new URLSearchParams(params).toString();`);
  lines.push(`    if (query) url += "?" + query;`);
  lines.push(`  }`);
  lines.push(`  const headers: Record<string, string> = { "Content-Type": "application/json" };`);
  lines.push(`  if (_apiKey) headers["X-API-Key"] = _apiKey;`);
  lines.push(`  if (_bearerToken) headers["Authorization"] = "Bearer " + _bearerToken;`);
  lines.push(`  const isIdempotent = method === "GET";\n`);
  lines.push(`  for (let attempt = 1; attempt <= retries; attempt++) {`);
  lines.push(`    const controller = new AbortController();`);
  lines.push(`    const timer = setTimeout(() => controller.abort(), timeoutMs);`);
  lines.push(`    try {`);
  lines.push(`      const res = await fetch(url, {`);
  lines.push(`        method,`);
  lines.push(`        headers,`);
  lines.push(`        body: body ? JSON.stringify(body) : undefined,`);
  lines.push(`        signal: controller.signal,`);
  lines.push(`      });`);
  lines.push(`      clearTimeout(timer);\n`);
  lines.push(`      if (!res.ok) {`);
  lines.push(`        const isRetryableStatus = res.status === 429 || res.status >= 500;`);
  lines.push(`        const errorBody = await parseErrorBody(res);`);
  lines.push(`        if (isIdempotent && isRetryableStatus && attempt < retries) {`);
  lines.push(`          await sleep(attempt * 1000);`);
  lines.push(`          continue;`);
  lines.push(`        }`);
  lines.push(`        throw new SDKError(\`API Error \${res.status}: \${res.statusText}\`, res.status, errorBody, isRetryableStatus);`);
  lines.push(`      }\n`);
  lines.push(`      if (res.status === 204) return undefined as unknown as T;`);
  lines.push(`      return (await res.json()) as T;`);
  lines.push(`    } catch (err) {`);
  lines.push(`      clearTimeout(timer);`);
  lines.push(`      if (err instanceof SDKError) throw err;`);
  lines.push(`      const isAbort = err instanceof Error && err.name === "AbortError";`);
  lines.push(`      if (isIdempotent && attempt < retries) {`);
  lines.push(`        await sleep(attempt * 1000);`);
  lines.push(`        continue;`);
  lines.push(`      }`);
  lines.push(`      if (isAbort) throw new SDKError("Request timed out", 0, undefined, false);`);
  lines.push(`      throw err;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  throw new SDKError("Request failed after " + retries + " retries", 0, undefined, false);`);
  lines.push(`}\n`);

  return lines;
}
