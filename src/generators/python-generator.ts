import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import { generatePyHeader, generatePyClientOpen, generatePyClientClose } from "./python/generators/header";
import { generatePyErrorClass } from "./python/generators/errors";
import { generatePyModels } from "./python/generators/models";
import { generatePyRequestFn } from "./python/generators/request";
import { generatePyEndpoints } from "./python/generators/endpoints";
import {
  generatePyMockImports,
  generatePyMockFactories,
  generatePyMockClientOpen,
  generatePyMockEndpoints,
} from "./python/generators/mock";

/**
 * يولّد SDK كامل بلغة Python من ApiSpec على شكل كلاس Client (+ MockClient)، ويكتبه في outputDir/sdk.py.
 * نفس معيار TypeScript بالضبط: SDKError, retry ذكي, timeout, Pydantic validation, Mock Client،
 * وبنفس مستوى الدعم لـ enum/union types.
 *
 * الاستخدام الحقيقي: client = Client(api_key="..."); client.get_users()
 * الاستخدام الوهمي:  client = MockClient(); client.get_users()
 */
export function generatePythonSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));
  const hasModels = spec.models.length > 0;
  const hasEnums = spec.enums.length > 0;

  const lines: string[] = [
    ...generatePyHeader(spec, hasModels, hasEnums),
    ...generatePyMockImports(),
    ...generatePyErrorClass(),
    ...generatePyModels(spec.models, spec.enums, spec.unions),
    ...generatePyClientOpen(spec),
    ...generatePyRequestFn(),
    ...generatePyEndpoints(spec.endpoints, modelNames),
    ...generatePyClientClose(),
    ...generatePyMockFactories(spec.models, spec.enums, spec.unions),
    ...generatePyMockClientOpen(),
    ...generatePyMockEndpoints(spec.endpoints, modelNames),
  ];

  const outputPath = path.join(outputDir, "sdk.py");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Python SDK generated at: ${outputPath}`);
}
