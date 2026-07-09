/**
 * يبني method خاص `RequestAsync` داخل Client:
 * - يبني query string من Dictionary<string, string>
 * - retry فقط على GET + (429/5xx/HttpRequestException) — نفس منطق باقي اللغات
 * - يرمي SDKException مع StatusCode/Body بدل exception عام
 * - يدعم CancellationToken (معيار async C# للإلغاء)
 */
export function generateCsRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`    private async Task<string> RequestAsync(string method, string path, string? body = null, Dictionary<string, string>? queryParams = null, int retries = 3, CancellationToken cancellationToken = default)`);
  lines.push(`    {`);
  lines.push(`        var url = _baseUrl + path;`);
  lines.push(`        if (queryParams != null && queryParams.Count > 0)`);
  lines.push(`        {`);
  lines.push(`            var query = string.Join("&", queryParams.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));`);
  lines.push(`            url += "?" + query;`);
  lines.push(`        }\n`);

  lines.push(`        bool isIdempotent = method == "GET";`);
  lines.push(`        Exception? lastError = null;\n`);

  lines.push(`        for (int attempt = 1; attempt <= retries; attempt++)`);
  lines.push(`        {`);
  lines.push(`            try`);
  lines.push(`            {`);
  lines.push(`                var request = new HttpRequestMessage(new HttpMethod(method), url);`);
  lines.push(`                if (_apiKey != null) request.Headers.Add("X-API-Key", _apiKey);`);
  lines.push(`                if (_bearerToken != null) request.Headers.Add("Authorization", "Bearer " + _bearerToken);`);
  lines.push(`                if (body != null) request.Content = new StringContent(body, Encoding.UTF8, "application/json");\n`);

  lines.push(`                var response = await _httpClient.SendAsync(request, cancellationToken);`);
  lines.push(`                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);\n`);

  lines.push(`                if (!response.IsSuccessStatusCode)`);
  lines.push(`                {`);
  lines.push(`                    int statusCode = (int)response.StatusCode;`);
  lines.push(`                    bool isRetryableStatus = statusCode == 429 || statusCode >= 500;`);
  lines.push(`                    if (isIdempotent && isRetryableStatus && attempt < retries)`);
  lines.push(`                    {`);
  lines.push(`                        await Task.Delay(attempt * 1000, cancellationToken);`);
  lines.push(`                        continue;`);
  lines.push(`                    }`);
  lines.push(`                    throw new SDKException($"API Error {statusCode}: {response.ReasonPhrase}", statusCode, responseBody, isRetryableStatus);`);
  lines.push(`                }\n`);

  lines.push(`                return responseBody;`);
  lines.push(`            }`);
  lines.push(`            catch (HttpRequestException err)`);
  lines.push(`            {`);
  lines.push(`                lastError = err;`);
  lines.push(`                if (isIdempotent && attempt < retries)`);
  lines.push(`                {`);
  lines.push(`                    await Task.Delay(attempt * 1000, cancellationToken);`);
  lines.push(`                    continue;`);
  lines.push(`                }`);
  lines.push(`                throw new SDKException($"Network error: {err.Message}", 0, null, false);`);
  lines.push(`            }`);
  lines.push(`        }\n`);

  lines.push(`        throw new SDKException($"Request failed after {retries} retries: {lastError?.Message}", 0, null, false);`);
  lines.push(`    }\n`);

  return lines;
}
