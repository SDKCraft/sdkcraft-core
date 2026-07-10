import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: imports أساسية */
export function generateDartHeader(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`import 'dart:async';`);
  lines.push(`import 'dart:convert';`);
  lines.push(`import 'dart:math';`);
  lines.push(`import 'package:http/http.dart' as http;`);
  lines.push(``);

  return lines;
}

/** يبني فتح كلاس Client مع constructor لاستقبال baseUrl/apiKey/bearerToken */
export function generateDartClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`class Client {`);
  lines.push(`  final String baseUrl;`);
  lines.push(`  final String? apiKey;`);
  lines.push(`  final String? bearerToken;`);
  lines.push(`  final Duration timeout;\n`);

  lines.push(`  Client({`);
  lines.push(`    this.baseUrl = '${spec.baseUrl}',`);
  lines.push(`    this.apiKey,`);
  lines.push(`    this.bearerToken,`);
  lines.push(`    this.timeout = const Duration(seconds: 30),`);
  lines.push(`  });\n`);

  return lines;
}

/** إغلاق كلاس Client */
export function generateDartClientClose(): string[] {
  return [`}\n`];
}
