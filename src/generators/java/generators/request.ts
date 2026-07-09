/**
 * يبني method خاص `request` داخل ApiClient:
 * - يبني query string من Map<String, String>
 * - retry فقط على GET + (429/5xx/IOException) — نفس منطق باقي اللغات
 * - يرمي SDKException مع statusCode/body بدل RuntimeException عام
 * - timeout لكل طلب (30 ثانية) عبر HttpRequest.Builder.timeout
 */
export function generateJavaRequestFn(hasModels: boolean): string[] {
  const lines: string[] = [];

  lines.push(`  private String request(String method, String path, String body, Map<String, String> params) throws SDKException {`);
  lines.push(`    StringBuilder urlBuilder = new StringBuilder(baseUrl).append(path);`);
  lines.push(`    if (params != null && !params.isEmpty()) {`);
  lines.push(`      urlBuilder.append("?");`);
  lines.push(`      boolean first = true;`);
  lines.push(`      for (Map.Entry<String, String> entry : params.entrySet()) {`);
  lines.push(`        if (!first) urlBuilder.append("&");`);
  lines.push(`        urlBuilder.append(entry.getKey()).append("=").append(entry.getValue());`);
  lines.push(`        first = false;`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    String url = urlBuilder.toString();`);
  lines.push(`    boolean isIdempotent = method.equals("GET");`);
  lines.push(`    int retries = 3;\n`);

  lines.push(`    for (int attempt = 1; attempt <= retries; attempt++) {`);
  lines.push(`      try {`);
  lines.push(`        HttpRequest.Builder builder = HttpRequest.newBuilder()`);
  lines.push(`          .uri(URI.create(url))`);
  lines.push(`          .timeout(Duration.ofSeconds(30))`);
  lines.push(`          .header("Content-Type", "application/json");`);
  lines.push(`        if (apiKey != null) builder.header("X-API-Key", apiKey);`);
  lines.push(`        if (bearerToken != null) builder.header("Authorization", "Bearer " + bearerToken);`);
  lines.push(`        if (method.equals("GET")) builder.GET();`);
  lines.push(`        else builder.method(method, HttpRequest.BodyPublishers.ofString(body != null ? body : ""));\n`);

  lines.push(`        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());\n`);

  lines.push(`        if (response.statusCode() >= 400) {`);
  lines.push(`          boolean isRetryableStatus = response.statusCode() == 429 || response.statusCode() >= 500;`);
  lines.push(`          if (isIdempotent && isRetryableStatus && attempt < retries) {`);
  lines.push(`            sleep(attempt);`);
  lines.push(`            continue;`);
  lines.push(`          }`);
  lines.push(`          throw new SDKException("API Error " + response.statusCode(), response.statusCode(), response.body(), isRetryableStatus);`);
  lines.push(`        }`);
  lines.push(`        return response.body();\n`);

  lines.push(`      } catch (java.io.IOException | InterruptedException err) {`);
  lines.push(`        if (isIdempotent && attempt < retries) {`);
  lines.push(`          sleep(attempt);`);
  lines.push(`          continue;`);
  lines.push(`        }`);
  lines.push(`        throw new SDKException("Network error: " + err.getMessage(), 0, null, false);`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    throw new SDKException("Request failed after " + retries + " retries", 0, null, false);`);
  lines.push(`  }\n`);

  lines.push(`  private void sleep(int attempt) {`);
  lines.push(`    try { TimeUnit.SECONDS.sleep(attempt); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }`);
  lines.push(`  }\n`);

  return lines;
}
