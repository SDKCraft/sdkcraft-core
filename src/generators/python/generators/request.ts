/**
 * يبني method خاص `_request` داخل كلاس Client:
 * - بناء الـ headers (API Key / Bearer Token)
 * - timeout (30 ثانية افتراضي)
 * - retry فقط على GET + (429/5xx/exception شبكة) — نفس منطق TypeScript بالظبط
 * - رمي SDKError مع status/body بدل exception عام من requests
 */
export function generatePyRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`    def _request(self, method: str, path: str, body: Optional[dict] = None, params: Optional[dict] = None, retries: int = 3, timeout: int = 30) -> Any:`);
  lines.push(`        url = self.base_url + path`);
  lines.push(`        headers = {"Content-Type": "application/json"}`);
  lines.push(`        if self.api_key:`);
  lines.push(`            headers["X-API-Key"] = self.api_key`);
  lines.push(`        if self.bearer_token:`);
  lines.push(`            headers["Authorization"] = "Bearer " + self.bearer_token`);
  lines.push(`        is_idempotent = method == "GET"`);
  lines.push(``);
  lines.push(`        for attempt in range(1, retries + 1):`);
  lines.push(`            try:`);
  lines.push(`                res = self.session.request(method, url, headers=headers, json=body, params=params, timeout=timeout)`);
  lines.push(`            except requests.RequestException as err:`);
  lines.push(`                if is_idempotent and attempt < retries:`);
  lines.push(`                    time.sleep(attempt)`);
  lines.push(`                    continue`);
  lines.push(`                raise SDKError(f"Network error: {err}", 0, None, False) from err`);
  lines.push(``);
  lines.push(`            if not res.ok:`);
  lines.push(`                is_retryable_status = res.status_code == 429 or res.status_code >= 500`);
  lines.push(`                try:`);
  lines.push(`                    error_body = res.json()`);
  lines.push(`                except ValueError:`);
  lines.push(`                    error_body = None`);
  lines.push(`                if is_idempotent and is_retryable_status and attempt < retries:`);
  lines.push(`                    time.sleep(attempt)`);
  lines.push(`                    continue`);
  lines.push(`                raise SDKError(f"API Error {res.status_code}: {res.reason}", res.status_code, error_body, is_retryable_status)`);
  lines.push(``);
  lines.push(`            if res.status_code == 204:`);
  lines.push(`                return None`);
  lines.push(`            return res.json()`);
  lines.push(``);
  lines.push(`        raise SDKError(f"Request failed after {retries} retries", 0, None, False)`);
  lines.push(``);

  return lines;
}
