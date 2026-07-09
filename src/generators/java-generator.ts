import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import { generateJavaHeader, generateJavaClientOpen } from "./java/generators/header";
import { generateJavaErrorClass } from "./java/generators/errors";
import { generateJavaModels } from "./java/generators/models";
import { generateJavaRequestFn } from "./java/generators/request";
import { generateJavaEndpoints } from "./java/generators/endpoints";
import {
  generateJavaMockFactories,
  generateJavaMockClientOpen,
  generateJavaMockEndpoints,
} from "./java/generators/mock";

/**
 * يولّد SDK كامل بلغة Java من ApiSpec، ويكتبه في outputDir/ApiClient.java.
 * نفس معيار TypeScript/Python/Go: SDKException, retry ذكي, timeout, POJOs عبر Jackson, MockApiClient.
 *
 * ملاحظة بنيوية مهمة: دوال buildX() الوهمية (static factories) لازم تكون
 * DAKHEL جسم كلاس MockApiClient نفسه، لأن جافا مش بتسمح بدوال عائمة برّه أي كلاس.
 *
 * الاستخدام الحقيقي: ApiClient client = new ApiClient("api-key"); client.getUsers(null);
 * الاستخدام الوهمي:  MockApiClient client = new MockApiClient(); client.getUsers(null);
 */
export function generateJavaSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));
  const hasModels = spec.models.length > 0;

  const lines: string[] = [
    ...generateJavaHeader(spec, hasModels),
    ...generateJavaErrorClass(),
    ...generateJavaModels(spec.models),
    ...generateJavaClientOpen(spec, hasModels),
    ...generateJavaRequestFn(hasModels),
    ...generateJavaEndpoints(spec.endpoints, modelNames),
    `}\n`,
    ...generateJavaMockClientOpen(),
    ...generateJavaMockFactories(spec.models),
    ...generateJavaMockEndpoints(spec.endpoints, modelNames),
    `}\n`,
  ];

  const outputPath = path.join(outputDir, "ApiClient.java");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Java SDK generated at: ${outputPath}`);
}
