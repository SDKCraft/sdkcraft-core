import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: package + imports + تعليق الترويسة */
export function generateGoHeader(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`package sdk`);
  lines.push(``);
  lines.push(`import (`);
  lines.push(`  "bytes"`);
  lines.push(`  "context"`);
  lines.push(`  "encoding/json"`);
  lines.push(`  "fmt"`);
  lines.push(`  "io"`);
  lines.push(`  "math/rand"`);
  lines.push(`  "net/http"`);
  lines.push(`  "net/url"`);
  lines.push(`  "time"`);
  lines.push(`)`);
  lines.push(``);

  return lines;
}

/** يبني struct Client + constructor NewClient مع Options اختيارية */
export function generateGoClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`type ClientOptions struct {`);
  lines.push(`  BaseURL     string`);
  lines.push(`  APIKey      string`);
  lines.push(`  BearerToken string`);
  lines.push(`}\n`);

  lines.push(`type Client struct {`);
  lines.push(`  baseURL     string`);
  lines.push(`  apiKey      string`);
  lines.push(`  bearerToken string`);
  lines.push(`  httpClient  *http.Client`);
  lines.push(`}\n`);

  lines.push(`func NewClient(opts ...ClientOptions) *Client {`);
  lines.push(`  c := &Client{baseURL: "${spec.baseUrl}", httpClient: &http.Client{Timeout: 30 * time.Second}}`);
  lines.push(`  if len(opts) > 0 {`);
  lines.push(`    if opts[0].BaseURL != "" { c.baseURL = opts[0].BaseURL }`);
  lines.push(`    c.apiKey = opts[0].APIKey`);
  lines.push(`    c.bearerToken = opts[0].BearerToken`);
  lines.push(`  }`);
  lines.push(`  return c`);
  lines.push(`}\n`);

  return lines;
}
