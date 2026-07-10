import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: تعليق الترويسة + import Foundation */
export function generateSwiftHeader(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`import Foundation`);
  lines.push(``);

  return lines;
}

/** يبني فتح كلاس Client مع init لاستقبال baseUrl/apiKey/bearerToken */
export function generateSwiftClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`class Client {`);
  lines.push(`  private let baseUrl: String`);
  lines.push(`  private let apiKey: String?`);
  lines.push(`  private let bearerToken: String?`);
  lines.push(`  private let session: URLSession\n`);

  lines.push(`  init(baseUrl: String = "${spec.baseUrl}", apiKey: String? = nil, bearerToken: String? = nil) {`);
  lines.push(`    self.baseUrl = baseUrl`);
  lines.push(`    self.apiKey = apiKey`);
  lines.push(`    self.bearerToken = bearerToken`);
  lines.push(`    let config = URLSessionConfiguration.default`);
  lines.push(`    config.timeoutIntervalForRequest = 30`);
  lines.push(`    self.session = URLSession(configuration: config)`);
  lines.push(`  }\n`);

  return lines;
}

/** إغلاق كلاس Client */
export function generateSwiftClientClose(): string[] {
  return [`}\n`];
}
