import { ApiSpec } from "../../../parsers/openapi-parser";

/** يبني الجزء العلوي: imports أساسية + kotlinx.serialization لو فيه models */
export function generateKtHeader(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  lines.push(`// Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`// Do not edit manually`);
  lines.push(``);
  lines.push(`import kotlinx.coroutines.Dispatchers`);
  lines.push(`import kotlinx.coroutines.delay`);
  lines.push(`import kotlinx.coroutines.withContext`);
  lines.push(`import java.net.HttpURLConnection`);
  lines.push(`import java.net.URL`);
  lines.push(`import java.net.URLEncoder`);
  if (hasModels) {
    lines.push(`import kotlinx.serialization.Serializable`);
    lines.push(`import kotlinx.serialization.decodeFromString`);
    lines.push(`import kotlinx.serialization.json.Json`);
  }
  lines.push(``);

  return lines;
}

/** يبني فتح كلاس Client مع constructor لاستقبال baseUrl/apiKey/bearerToken */
export function generateKtClientOpen(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  if (hasModels) {
    lines.push(`private val json = Json { ignoreUnknownKeys = true }\n`);
  }

  lines.push(`class Client(`);
  lines.push(`  private val baseUrl: String = "${spec.baseUrl}",`);
  lines.push(`  private val apiKey: String? = null,`);
  lines.push(`  private val bearerToken: String? = null,`);
  lines.push(`  private val timeoutMs: Int = 30000`);
  lines.push(`) {\n`);

  return lines;
}

/** إغلاق كلاس Client */
export function generateKtClientClose(): string[] {
  return [`}\n`];
}
