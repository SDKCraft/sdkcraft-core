/**
 * يبني suspend fun خاصة `request` داخل Client:
 * - يبني query string من Map<String, String>
 * - retry فقط على GET + (429/5xx/IOException) — نفس منطق باقي اللغات
 * - يرمي SDKException مع statusCode/body بدل Exception عام
 * - كله جوه withContext(Dispatchers.IO) للعمل غير المتزامن الصحيح
 */
export function generateKtRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`  private suspend fun request(method: String, path: String, body: String? = null, params: Map<String, String>? = null, retries: Int = 3): String {`);
  lines.push(`    var fullPath = path`);
  lines.push(`    if (!params.isNullOrEmpty()) {`);
  lines.push(`      val query = params.entries.joinToString("&") { (k, v) -> "\$k=\${URLEncoder.encode(v, "UTF-8")}" }`);
  lines.push(`      fullPath += "?\$query"`);
  lines.push(`    }`);
  lines.push(`    val isIdempotent = method == "GET"`);
  lines.push(`    var lastError: Exception? = null\n`);

  lines.push(`    for (attempt in 1..retries) {`);
  lines.push(`      try {`);
  lines.push(`        return withContext(Dispatchers.IO) {`);
  lines.push(`          val url = URL(baseUrl + fullPath)`);
  lines.push(`          val conn = url.openConnection() as HttpURLConnection`);
  lines.push(`          conn.requestMethod = method`);
  lines.push(`          conn.connectTimeout = timeoutMs`);
  lines.push(`          conn.readTimeout = timeoutMs`);
  lines.push(`          conn.setRequestProperty("Content-Type", "application/json")`);
  lines.push(`          apiKey?.let { conn.setRequestProperty("X-API-Key", it) }`);
  lines.push(`          bearerToken?.let { conn.setRequestProperty("Authorization", "Bearer \$it") }`);
  lines.push(`          if (body != null) {`);
  lines.push(`            conn.doOutput = true`);
  lines.push(`            conn.outputStream.write(body.toByteArray())`);
  lines.push(`          }\n`);

  lines.push(`          val code = conn.responseCode`);
  lines.push(`          if (code >= 400) {`);
  lines.push(`            val errorBody = conn.errorStream?.bufferedReader()?.readText()`);
  lines.push(`            val isRetryableStatus = code == 429 || code >= 500`);
  lines.push(`            if (isIdempotent && isRetryableStatus && attempt < retries) {`);
  lines.push(`              throw SDKException("retryable", code, errorBody, true)`);
  lines.push(`            }`);
  lines.push(`            throw SDKException("API Error \$code: \${conn.responseMessage}", code, errorBody, isRetryableStatus)`);
  lines.push(`          }\n`);

  lines.push(`          conn.inputStream.bufferedReader().readText()`);
  lines.push(`        }`);
  lines.push(`      } catch (err: SDKException) {`);
  lines.push(`        if (err.isRetryable && attempt < retries) {`);
  lines.push(`          delay(attempt * 1000L)`);
  lines.push(`          lastError = err`);
  lines.push(`          continue`);
  lines.push(`        }`);
  lines.push(`        throw err`);
  lines.push(`      } catch (err: java.io.IOException) {`);
  lines.push(`        if (isIdempotent && attempt < retries) {`);
  lines.push(`          delay(attempt * 1000L)`);
  lines.push(`          lastError = err`);
  lines.push(`          continue`);
  lines.push(`        }`);
  lines.push(`        throw SDKException("Network error: \${err.message}", 0, null, false)`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    throw SDKException("Request failed after \$retries retries: \${lastError?.message}", 0, null, false)`);
  lines.push(`  }\n`);

  return lines;
}
