/**
 * يبني method خاص `_request` داخل Client:
 * - يبني query string من Map<String, String>
 * - retry فقط على GET + (429/5xx/network error) — نفس منطق باقي اللغات
 * - يرمي SDKException مع statusCode/body بدل exception عام
 * - timeout عبر .timeout() على كل استدعاء http
 */
export function generateDartRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`  Future<dynamic> _request(String method, String path, {Map<String, dynamic>? body, Map<String, String>? params, int retries = 3}) async {`);
  lines.push(`    Uri uri = Uri.parse(baseUrl + path);`);
  lines.push(`    if (params != null && params.isNotEmpty) {`);
  lines.push(`      uri = uri.replace(queryParameters: params);`);
  lines.push(`    }\n`);

  lines.push(`    final headers = <String, String>{'Content-Type': 'application/json'};`);
  lines.push(`    if (apiKey != null) headers['X-API-Key'] = apiKey!;`);
  lines.push(`    if (bearerToken != null) headers['Authorization'] = 'Bearer \$bearerToken';\n`);

  lines.push(`    final isIdempotent = method == 'GET';`);
  lines.push(`    Object? lastError;\n`);

  lines.push(`    for (int attempt = 1; attempt <= retries; attempt++) {`);
  lines.push(`      try {`);
  lines.push(`        http.Response response;`);
  lines.push(`        switch (method) {`);
  lines.push(`          case 'GET':`);
  lines.push(`            response = await http.get(uri, headers: headers).timeout(timeout);`);
  lines.push(`            break;`);
  lines.push(`          case 'POST':`);
  lines.push(`            response = await http.post(uri, headers: headers, body: jsonEncode(body)).timeout(timeout);`);
  lines.push(`            break;`);
  lines.push(`          case 'PUT':`);
  lines.push(`            response = await http.put(uri, headers: headers, body: jsonEncode(body)).timeout(timeout);`);
  lines.push(`            break;`);
  lines.push(`          default:`);
  lines.push(`            response = await http.delete(uri, headers: headers).timeout(timeout);`);
  lines.push(`        }\n`);

  lines.push(`        if (response.statusCode >= 400) {`);
  lines.push(`          final isRetryableStatus = response.statusCode == 429 || response.statusCode >= 500;`);
  lines.push(`          if (isIdempotent && isRetryableStatus && attempt < retries) {`);
  lines.push(`            await Future.delayed(Duration(seconds: attempt));`);
  lines.push(`            continue;`);
  lines.push(`          }`);
  lines.push(`          throw SDKException('API Error \${response.statusCode}: \${response.reasonPhrase}', response.statusCode, response.body, isRetryableStatus);`);
  lines.push(`        }\n`);

  lines.push(`        if (response.body.isEmpty) return null;`);
  lines.push(`        return jsonDecode(response.body);`);
  lines.push(`      } on SDKException {`);
  lines.push(`        rethrow;`);
  lines.push(`      } catch (err) {`);
  lines.push(`        lastError = err;`);
  lines.push(`        if (isIdempotent && attempt < retries) {`);
  lines.push(`          await Future.delayed(Duration(seconds: attempt));`);
  lines.push(`          continue;`);
  lines.push(`        }`);
  lines.push(`        throw SDKException('Network error: \$err', 0, null, false);`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    throw SDKException('Request failed after \$retries retries: \$lastError', 0, null, false);`);
  lines.push(`  }\n`);

  return lines;
}
