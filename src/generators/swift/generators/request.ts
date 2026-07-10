/**
 * يبني private func async `request<T: Decodable>` داخل Client:
 * - يبني query string من [String: String]
 * - retry فقط على GET + (429/5xx/network error) — نفس منطق باقي اللغات
 * - يرمي SDKError مع statusCode/body بدل NSError عام
 * - async/await بالكامل (معيار Swift الحديث 5.5+)، بدل completion handlers قديمة
 */
export function generateSwiftRequestFn(): string[] {
  const lines: string[] = [];

  lines.push(`  private func request<T: Decodable>(_ method: String, path: String, body: Data? = nil, params: [String: String]? = nil, retries: Int = 3) async throws -> T {`);
  lines.push(`    var urlString = baseUrl + path`);
  lines.push(`    if let params = params, !params.isEmpty {`);
  lines.push(`      let query = params.map { "\\($0.key)=\\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }.joined(separator: "&")`);
  lines.push(`      urlString += "?" + query`);
  lines.push(`    }`);
  lines.push(`    guard let url = URL(string: urlString) else {`);
  lines.push(`      throw SDKError(message: "Invalid URL: \\(urlString)", statusCode: 0, body: nil, isRetryable: false)`);
  lines.push(`    }\n`);

  lines.push(`    let isIdempotent = method == "GET"`);
  lines.push(`    var lastError: Error?\n`);

  lines.push(`    for attempt in 1...retries {`);
  lines.push(`      var req = URLRequest(url: url)`);
  lines.push(`      req.httpMethod = method`);
  lines.push(`      req.setValue("application/json", forHTTPHeaderField: "Content-Type")`);
  lines.push(`      if let key = apiKey { req.setValue(key, forHTTPHeaderField: "X-API-Key") }`);
  lines.push(`      if let token = bearerToken { req.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization") }`);
  lines.push(`      req.httpBody = body\n`);

  lines.push(`      do {`);
  lines.push(`        let (data, response) = try await session.data(for: req)`);
  lines.push(`        guard let httpResponse = response as? HTTPURLResponse else {`);
  lines.push(`          throw SDKError(message: "Invalid response", statusCode: 0, body: nil, isRetryable: false)`);
  lines.push(`        }\n`);

  lines.push(`        if httpResponse.statusCode >= 400 {`);
  lines.push(`          let isRetryableStatus = httpResponse.statusCode == 429 || httpResponse.statusCode >= 500`);
  lines.push(`          let errorBody = String(data: data, encoding: .utf8)`);
  lines.push(`          if isIdempotent && isRetryableStatus && attempt < retries {`);
  lines.push(`            try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)`);
  lines.push(`            continue`);
  lines.push(`          }`);
  lines.push(`          throw SDKError(message: "API Error \\(httpResponse.statusCode)", statusCode: httpResponse.statusCode, body: errorBody, isRetryable: isRetryableStatus)`);
  lines.push(`        }\n`);

  lines.push(`        return try JSONDecoder().decode(T.self, from: data)`);
  lines.push(`      } catch let err as SDKError {`);
  lines.push(`        throw err`);
  lines.push(`      } catch {`);
  lines.push(`        lastError = error`);
  lines.push(`        if isIdempotent && attempt < retries {`);
  lines.push(`          try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)`);
  lines.push(`          continue`);
  lines.push(`        }`);
  lines.push(`        throw SDKError(message: "Network error: \\(error.localizedDescription)", statusCode: 0, body: nil, isRetryable: false)`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`    throw SDKError(message: "Request failed after \\(retries) retries: \\(lastError?.localizedDescription ?? "")", statusCode: 0, body: nil, isRetryable: false)`);
  lines.push(`  }\n`);

  return lines;
}
