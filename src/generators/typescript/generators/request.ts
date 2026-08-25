/**
 * يبني method خاص `request<T>` داخل كلاس Client، مسؤول عن:
 * - بناء الـ URL النهائي (مع query params) من this.baseUrl
 * - إرفاق هيدرز المصادقة (this.apiKey / this.bearerToken)
 * - timeout عبر AbortController
 * - إعادة المحاولة (retry) فقط على GET + (429 أو 5xx أو خطأ شبكة)
 * - رمي SDKError مع status/body بدل Error عام
 */
export function generateRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`  private async sleep(ms: number): Promise<void> {`);
  lines.push(`    return new Promise(resolve => setTimeout(resolve, ms));`);
  lines.push(`  }\n`);

  lines.push(`  private async parseErrorBody(res: Response): Promise<unknown> {`);
  lines.push(`    try { return await res.json(); } catch { return undefined; }`);
  lines.push(`  }\n`);

  lines.push(`  /** Exponential backoff + full jitter: base 500ms, doubles per attempt, capped at 8s, honors Retry-After when given. */`);
  lines.push(`  private backoffDelay(attempt: number, retryAfterMs?: number): number {`);
  lines.push(`    if (retryAfterMs !== undefined && retryAfterMs >= 0) return retryAfterMs;`);
  lines.push(`    const base = 500;`);
  lines.push(`    const cap = 8000;`);
  lines.push(`    const exp = Math.min(cap, base * Math.pow(2, attempt - 1));`);
  lines.push(`    return Math.random() * exp;`);
  lines.push(`  }\n`);

  lines.push(`  private parseRetryAfter(res: Response): number | undefined {`);
  lines.push(`    const header = res.headers?.get?.("Retry-After");`);
  lines.push(`    if (!header) return undefined;`);
  lines.push(`    const seconds = Number(header);`);
  lines.push(`    if (!Number.isNaN(seconds)) return seconds * 1000;`);
  lines.push(`    const dateMs = Date.parse(header);`);
  lines.push(`    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());`);
  lines.push(`    return undefined;`);
  lines.push(`  }\n`);

  lines.push(`  private async request<T>(method: string, path: string, body?: Record<string, unknown>, params?: Record<string, string>, retries = 3, timeoutMs = 30000): Promise<T> {`);
  lines.push(`    let url = this.baseUrl + path;`);
  lines.push(`    if (params) {`);
  lines.push(`      const query = new URLSearchParams(params).toString();`);
  lines.push(`      if (query) url += "?" + query;`);
  lines.push(`    }`);
  lines.push(`    let headers: Record<string, string> = { "Content-Type": "application/json", ...this.customHeaders };`);
  lines.push(`    if (this.apiKey) headers["X-API-Key"] = this.apiKey;`);
  lines.push(`    if (this.bearerToken) headers["Authorization"] = "Bearer " + this.bearerToken;`);
  lines.push(`    let requestBody = body ? JSON.stringify(body) : undefined;\n`);
  lines.push(`    if (this.requestInterceptor) {`);
  lines.push(`      const config = await this.requestInterceptor({ url, method, headers, body: requestBody });`);
  lines.push(`      url = config.url;`);
  lines.push(`      method = config.method;`);
  lines.push(`      headers = config.headers;`);
  lines.push(`      requestBody = config.body;`);
  lines.push(`    }\n`);
  lines.push(`    const isIdempotent = method === "GET";\n`);
  lines.push(`    for (let attempt = 1; attempt <= retries; attempt++) {`);
  lines.push(`      const controller = new AbortController();`);
  lines.push(`      const timer = setTimeout(() => controller.abort(), timeoutMs);`);
  lines.push(`      try {`);
  lines.push(`        let res = await fetch(url, {`);
  lines.push(`          method,`);
  lines.push(`          headers,`);
  lines.push(`          body: requestBody,`);
  lines.push(`          signal: controller.signal,`);
  lines.push(`        });`);
  lines.push(`        clearTimeout(timer);\n`);
  lines.push(`        if (this.responseInterceptor) {`);
  lines.push(`          res = await this.responseInterceptor(res);`);
  lines.push(`        }\n`);
  lines.push(`        if (!res.ok) {`);
  lines.push(`          const isRetryableStatus = res.status === 429 || res.status >= 500;`);
  lines.push(`          const errorBody = await this.parseErrorBody(res);`);
  lines.push(`          if (isIdempotent && isRetryableStatus && attempt < retries) {`);
  lines.push(`            const retryAfterMs = res.status === 429 ? this.parseRetryAfter(res) : undefined;`);
  lines.push(`            await this.sleep(this.backoffDelay(attempt, retryAfterMs));`);
  lines.push(`            continue;`);
  lines.push(`          }`);
  lines.push(`          throw new SDKError(\`API Error \${res.status}: \${res.statusText}\`, res.status, errorBody, isRetryableStatus);`);
  lines.push(`        }\n`);
  lines.push(`        if (res.status === 204) return undefined as unknown as T;`);
  lines.push(`        return (await res.json()) as T;`);
  lines.push(`      } catch (err) {`);
  lines.push(`        clearTimeout(timer);`);
  lines.push(`        if (err instanceof SDKError) throw err;`);
  lines.push(`        const isAbort = err instanceof Error && err.name === "AbortError";`);
  lines.push(`        if (isIdempotent && attempt < retries) {`);
  lines.push(`          await this.sleep(this.backoffDelay(attempt));`);
  lines.push(`          continue;`);
  lines.push(`        }`);
  lines.push(`        if (isAbort) throw new SDKError("Request timed out", 0, undefined, false);`);
  lines.push(`        throw err;`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    throw new SDKError("Request failed after " + retries + " retries", 0, undefined, false);`);
  lines.push(`  }\n`);

  return lines;
}