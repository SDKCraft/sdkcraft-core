import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: تعليق الترويسة + imports */
export function generateJavaHeader(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`import java.net.URI;`);
  lines.push(`import java.net.http.HttpClient;`);
  lines.push(`import java.net.http.HttpRequest;`);
  lines.push(`import java.net.http.HttpResponse;`);
  lines.push(`import java.time.Duration;`);
  lines.push(`import java.util.Map;`);
  lines.push(`import java.util.concurrent.TimeUnit;`);
  if (hasModels) {
    lines.push(`import com.fasterxml.jackson.annotation.JsonProperty;`);
    lines.push(`import com.fasterxml.jackson.databind.ObjectMapper;`);
    lines.push(`import com.fasterxml.jackson.core.type.TypeReference;`);
  }
  lines.push(``);

  return lines;
}

/** يبني فتح كلاس ApiClient + constructor مع Builder-style options */
export function generateJavaClientOpen(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  lines.push(`public class ApiClient {`);
  lines.push(`  private final String baseUrl;`);
  lines.push(`  private final String apiKey;`);
  lines.push(`  private final String bearerToken;`);
  lines.push(`  private final HttpClient httpClient;`);
  if (hasModels) {
    lines.push(`  private final ObjectMapper mapper = new ObjectMapper();`);
  }
  lines.push(``);

  lines.push(`  public ApiClient() { this("${spec.baseUrl}", null, null); }`);
  lines.push(`  public ApiClient(String apiKey) { this("${spec.baseUrl}", apiKey, null); }`);
  lines.push(`  public ApiClient(String baseUrl, String apiKey, String bearerToken) {`);
  lines.push(`    this.baseUrl = baseUrl;`);
  lines.push(`    this.apiKey = apiKey;`);
  lines.push(`    this.bearerToken = bearerToken;`);
  lines.push(`    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();`);
  lines.push(`  }\n`);

  return lines;
}
