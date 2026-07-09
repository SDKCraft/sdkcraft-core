import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import {
  generateCsHeader,
  generateCsClientOpen,
  generateCsClientClose,
  generateCsNamespaceClose,
} from "./csharp/generators/header";
import { generateCsErrorClass } from "./csharp/generators/errors";
import { generateCsModels } from "./csharp/generators/models";
import { generateCsRequestFn } from "./csharp/generators/request";
import { generateCsEndpoints } from "./csharp/generators/endpoints";
import {
  generateCsMockFactories,
  generateCsMockClientOpen,
  generateCsMockEndpoints,
} from "./csharp/generators/mock";

/**
 * يولّد SDK كامل بلغة C# من ApiSpec (+ MockClient)، ويكتبه في outputDir/Client.cs.
 * نفس معيار TypeScript/Python/Go/Java: SDKException, retry ذكي, timeout, typed classes
 * عبر System.Text.Json, MockClient. كل شي async/await (معيار C# الحديث).
 *
 * الاستخدام الحقيقي: var client = new Client(apiKey: "..."); await client.GetUsersAsync();
 * الاستخدام الوهمي:  var client = new MockClient(); await client.GetUsersAsync();
 */
export function generateCSharpSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));

  const lines: string[] = [
    ...generateCsHeader(spec),
    ...generateCsErrorClass(),
    ...generateCsModels(spec.models),
    ...generateCsClientOpen(spec),
    ...generateCsRequestFn(),
    ...generateCsEndpoints(spec.endpoints, modelNames),
    ...generateCsClientClose(),
    ...generateCsMockClientOpen(),
    ...generateCsMockFactories(spec.models),
    ...generateCsMockEndpoints(spec.endpoints, modelNames),
    ...generateCsClientClose(),
    ...generateCsNamespaceClose(),
  ];

  const outputPath = path.join(outputDir, "Client.cs");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ C# SDK generated at: ${outputPath}`);
}
