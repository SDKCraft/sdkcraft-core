import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import {
  generateSwiftHeader,
  generateSwiftClientOpen,
  generateSwiftClientClose,
} from "./swift/generators/header";
import { generateSwiftErrorClass } from "./swift/generators/errors";
import { generateSwiftModels } from "./swift/generators/models";
import { generateSwiftRequestFn } from "./swift/generators/request";
import { generateSwiftEndpoints } from "./swift/generators/endpoints";
import {
  generateSwiftMockFactories,
  generateSwiftMockClientOpen,
  generateSwiftMockClientClose,
  generateSwiftMockEndpoints,
} from "./swift/generators/mock";

/**
 * يولّد SDK كامل بلغة Swift من ApiSpec (+ MockClient)، ويكتبه في outputDir/SDKClient.swift.
 * نفس معيار باقي اللغات: SDKError, retry ذكي, timeout, structs typed عبر Codable, MockClient.
 * async/await بالكامل (معيار Swift الحديث 5.5+)، بدل completion handlers القديمة.
 *
 * الاستخدام الحقيقي: let client = Client(apiKey: "..."); let users = try await client.getUsers()
 * الاستخدام الوهمي:  let client = MockClient(); let users = try await client.getUsers()
 */
export function generateSwiftSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));

  const lines: string[] = [
    ...generateSwiftHeader(spec),
    ...generateSwiftErrorClass(),
    ...generateSwiftModels(spec.models),
    ...generateSwiftClientOpen(spec),
    ...generateSwiftRequestFn(),
    ...generateSwiftEndpoints(spec.endpoints, modelNames),
    ...generateSwiftClientClose(),
    ...generateSwiftMockClientOpen(),
    ...generateSwiftMockFactories(spec.models),
    ...generateSwiftMockEndpoints(spec.endpoints, modelNames),
    ...generateSwiftMockClientClose(),
  ];

  const outputPath = path.join(outputDir, "SDKClient.swift");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Swift SDK generated at: ${outputPath}`);
}
