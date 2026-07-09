import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import { generateGoHeader, generateGoClientOpen } from "./go/generators/header";
import { generateGoErrorClass } from "./go/generators/errors";
import { generateGoModels } from "./go/generators/models";
import { generateGoRequestFn } from "./go/generators/request";
import { generateGoEndpoints } from "./go/generators/endpoints";
import {
  generateGoMockFactories,
  generateGoMockClientOpen,
  generateGoMockEndpoints,
} from "./go/generators/mock";

/**
 * يولّد SDK كامل بلغة Go من ApiSpec على شكل struct Client (+ MockClient)، ويكتبه في outputDir/sdk.go.
 * نفس معيار TypeScript/Python: SDKError, retry ذكي, timeout, structs typed (بدل map), Mock Client.
 * إضافة خاصة بـ Go: context.Context في كل method (معيار Go لدعم الإلغاء والـ deadlines).
 *
 * الاستخدام الحقيقي: client := sdk.NewClient(sdk.ClientOptions{APIKey: "..."}); client.GetUsers(ctx)
 * الاستخدام الوهمي:  client := sdk.NewMockClient(); client.GetUsers(ctx)
 */
export function generateGoSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));

  const lines: string[] = [
    ...generateGoHeader(spec),
    ...generateGoErrorClass(),
    ...generateGoModels(spec.models),
    ...generateGoClientOpen(spec),
    ...generateGoRequestFn(),
    ...generateGoEndpoints(spec.endpoints, modelNames),
    ...generateGoMockFactories(spec.models),
    ...generateGoMockClientOpen(),
    ...generateGoMockEndpoints(spec.endpoints, modelNames),
  ];

  const outputPath = path.join(outputDir, "sdk.go");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ Go SDK generated at: ${outputPath}`);
}
