import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: using statements + فتح namespace */
export function generateCsHeader(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`using System;`);
  lines.push(`using System.Collections.Generic;`);
  lines.push(`using System.Linq;`);
  lines.push(`using System.Net.Http;`);
  lines.push(`using System.Text;`);
  lines.push(`using System.Text.Json;`);
  lines.push(`using System.Text.Json.Serialization;`);
  lines.push(`using System.Threading;`);
  lines.push(`using System.Threading.Tasks;`);
  lines.push(``);
  lines.push(`namespace SDKCraft.Generated`);
  lines.push(`{`);

  return lines;
}

/** يبني فتح كلاس Client + constructor مع HttpClient واحد مشترك */
export function generateCsClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`public class Client`);
  lines.push(`{`);
  lines.push(`    private readonly string _baseUrl;`);
  lines.push(`    private readonly string? _apiKey;`);
  lines.push(`    private readonly string? _bearerToken;`);
  lines.push(`    private readonly HttpClient _httpClient;\n`);

  lines.push(`    public Client(string baseUrl = "${spec.baseUrl}", string? apiKey = null, string? bearerToken = null)`);
  lines.push(`    {`);
  lines.push(`        _baseUrl = baseUrl;`);
  lines.push(`        _apiKey = apiKey;`);
  lines.push(`        _bearerToken = bearerToken;`);
  lines.push(`        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };`);
  lines.push(`    }\n`);

  return lines;
}

/** إغلاق كلاس Client */
export function generateCsClientClose(): string[] {
  return [`}\n`];
}

/** إغلاق namespace (آخر سطر في الملف) */
export function generateCsNamespaceClose(): string[] {
  return [`}`];
}
