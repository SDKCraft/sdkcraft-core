import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import {
  generateDartHeader,
  generateDartClientOpen,
  generateDartClientClose,
} from "./dart/generators/header";
import { generateDartErrorClass } from "./dart/generators/errors";
import { generateDartModels } from "./dart/generators/models";
import { generateDartRequestFn } from "./dart/generators/request";
import { generateDartEndpoints } from "./dart/generators/endpoints";
import {
  generateDartMockFactories,
  generateDartMockClientOpen,
  generateDartMockClientClose,
  generateDartMockEndpoints,
} from "./dart/generators/mock";

/**
 * يولّد SDK كامل بلغة Dart من ApiSpec (+ MockClient)، ويكتبه في outputDir/sdk.dart.
 * نفس معيار باقي اللغات: SDKException, retry ذكي, timeout, classes typed عبر fromJson/toJson
 * (بدون مكتبات خارجية زي json_serializable)، MockClient.
 *
 * مهم بشكل خاص: مناسب للاستخدام المباشر داخل تطبيقات Flutter.
 *
 * الاستخدام الحقيقي: final client = Client(apiKey: '...'); final users = await client.getUsers();
 * الاستخدام الوهمي:  final client = MockClient(); final users = await client.getUsers();
 */
export function generateDartSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));

  const lines: string[] = [
    ...generateDartHeader(spec),
    ...generateDartErrorClass(),
    ...generateDartModels(spec.models),
    ...generateDartClientOpen(spec),
    ...generateDartRequestFn(),
    ...generateDartEndpoints(spec.endpoints, modelNames),
    ...generateDartClientClose(),
    ...generateDartMockClientOpen(),
    ...generateDartMockFactories(spec.models),
    ...generateDartMockEndpoints(spec.endpoints, modelNames),
    ...generateDartMockClientClose(),
  ];

  const outputPath = path.join(outputDir, "sdk.dart");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Dart SDK generated at: ${outputPath}`);
}
