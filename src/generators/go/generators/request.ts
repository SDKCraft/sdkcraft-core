/**
 * يبني method خاص `doRequest` داخل Client:
 * - يستقبل context.Context كأول باراميتر (معيار Go الأساسي للإلغاء والـ deadlines)
 * - يدعم query params عبر url.Values
 * - retry فقط على GET + (429/5xx/خطأ شبكة) — نفس منطق TypeScript/Python
 * - يرجع *SDKError مع StatusCode/Body بدل fmt.Errorf عام
 */
export function generateGoRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, params map[string]string) ([]byte, error) {`);
  lines.push(`  fullURL := c.baseURL + path`);
  lines.push(`  if len(params) > 0 {`);
  lines.push(`    q := url.Values{}`);
  lines.push(`    for k, v := range params { q.Set(k, v) }`);
  lines.push(`    fullURL += "?" + q.Encode()`);
  lines.push(`  }\n`);

  lines.push(`  isIdempotent := method == "GET"`);
  lines.push(`  const retries = 3`);
  lines.push(`  var lastErr error\n`);

  lines.push(`  for attempt := 1; attempt <= retries; attempt++ {`);
  lines.push(`    var reqBody io.Reader`);
  lines.push(`    if body != nil {`);
  lines.push(`      data, err := json.Marshal(body)`);
  lines.push(`      if err != nil { return nil, err }`);
  lines.push(`      reqBody = bytes.NewBuffer(data)`);
  lines.push(`    }\n`);

  lines.push(`    req, err := http.NewRequestWithContext(ctx, method, fullURL, reqBody)`);
  lines.push(`    if err != nil { return nil, err }`);
  lines.push(`    req.Header.Set("Content-Type", "application/json")`);
  lines.push(`    if c.apiKey != "" { req.Header.Set("X-API-Key", c.apiKey) }`);
  lines.push(`    if c.bearerToken != "" { req.Header.Set("Authorization", "Bearer "+c.bearerToken) }\n`);

  lines.push(`    res, err := c.httpClient.Do(req)`);
  lines.push(`    if err != nil {`);
  lines.push(`      lastErr = err`);
  lines.push(`      if isIdempotent && attempt < retries {`);
  lines.push(`        time.Sleep(time.Duration(attempt) * time.Second)`);
  lines.push(`        continue`);
  lines.push(`      }`);
  lines.push(`      return nil, &SDKError{Message: fmt.Sprintf("network error: %v", err), StatusCode: 0, IsRetryable: false}`);
  lines.push(`    }`);
  lines.push(`    defer res.Body.Close()\n`);

  lines.push(`    respBody, _ := io.ReadAll(res.Body)\n`);

  lines.push(`    if res.StatusCode >= 400 {`);
  lines.push(`      isRetryableStatus := res.StatusCode == 429 || res.StatusCode >= 500`);
  lines.push(`      if isIdempotent && isRetryableStatus && attempt < retries {`);
  lines.push(`        time.Sleep(time.Duration(attempt) * time.Second)`);
  lines.push(`        continue`);
  lines.push(`      }`);
  lines.push(`      return nil, &SDKError{`);
  lines.push(`        Message:     fmt.Sprintf("API Error %d: %s", res.StatusCode, res.Status),`);
  lines.push(`        StatusCode:  res.StatusCode,`);
  lines.push(`        Body:        respBody,`);
  lines.push(`        IsRetryable: isRetryableStatus,`);
  lines.push(`      }`);
  lines.push(`    }\n`);

  lines.push(`    return respBody, nil`);
  lines.push(`  }\n`);

  lines.push(`  return nil, &SDKError{Message: fmt.Sprintf("request failed after %d retries: %v", retries, lastErr), StatusCode: 0, IsRetryable: false}`);
  lines.push(`}\n`);

  return lines;
}
