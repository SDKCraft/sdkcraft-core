import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import {
  generateKtHeader,
  generateKtClientOpen,
  generateKtClientClose,
} from "./kotlin/generators/header";
import { generateKtErrorClass } from "./kotlin/generators/errors";
import { generateKtModels } from "./kotlin/generators/models";
import { generateKtRequestFn } from "./kotlin/generators/request";
import { generateKtEndpoints } from "./kotlin/generators/endpoints";
import {
  generateKtMockFactories,
  generateKtMockClientOpen,
  generateKtMockClientClose,
  generateKtMockEndpoints,
} from "./kotlin/generators/mock";

/**
 * يولّد SDK كامل بلغة Kotlin من ApiSpec (+ MockClient)، ويكتبه في outputDir/ApiClient.kt.
 * نفس معيار TypeScript/Python/Go/Java/C#: SDKException, retry ذكي, timeout,
 * data classes typed عبر kotlinx.serialization, MockClient. كله عبر suspend fun (coroutines).
 *
 * الاستخدام الحقيقي: val client = Client(apiKey = "..."); client.getUsers()
 * الاستخدام الوهمي:  val client = MockClient(); client.getUsers()
 */
export function generateKotlinSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));
  const hasModels = spec.models.length > 0;

  const lines: string[] = [
    ...generateKtHeader(spec, hasModels),
    ...generateKtErrorClass(),
    ...generateKtModels(spec.models),
    ...generateKtClientOpen(spec, hasModels),
    ...generateKtRequestFn(),
    ...generateKtEndpoints(spec.endpoints, modelNames),
    ...generateKtClientClose(),
    ...generateKtMockClientOpen(),
    ...generateKtMockFactories(spec.models),
    ...generateKtMockEndpoints(spec.endpoints, modelNames),
    ...generateKtMockClientClose(),
  ];

  const outputPath = path.join(outputDir, "ApiClient.kt");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Kotlin SDK generated at: ${outputPath}`);
}
