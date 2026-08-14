import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import { generateHeader, generateClientOpen, generateClientClose } from "./typescript/generators/header";
import { generateModels } from "./typescript/generators/models";
import { generateRequestFn } from "./typescript/generators/request";
import { generatePaginateFn } from "./typescript/generators/paginate";
import { generateEndpoints } from "./typescript/generators/endpoints";
import { generateErrorClass } from "./typescript/generators/errors";
import { generateZodSchemas } from "./typescript/generators/zod-schemas";
import { generateMockFactories } from "./typescript/generators/mock-data";
import {
  generateMockClientOpen,
  generateMockClientClose,
  generateMockEndpoints,
} from "./typescript/generators/mock-client";

/**
 * يولّد SDK كامل بلغة TypeScript من ApiSpec على شكل كلاس Client، ويكتبه في outputDir/index.ts.
 * بيولّد كمان MockClient بنفس الواجهة تمامًا، بيانات وهمية بدون اتصال شبكة حقيقي —
 * ميزة تنافسية: مفيدة لتطوير الفرونت إند والاختبارات قبل جاهزية الـ backend.
 *
 * الاستخدام الحقيقي: const client = new Client({ apiKey: "..." }); await client.getUsers();
 * الاستخدام الوهمي:  const client = new MockClient(); await client.getUsers();
 */
export function generateTypeScriptSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const modelNames = new Set(spec.models.map(m => m.name));

  const lines: string[] = [
    ...generateHeader(spec, spec.models.length > 0),
    ...generateErrorClass(),
    ...generateZodSchemas(spec.models, spec.enums, spec.unions),
    ...generateModels(spec.models, spec.enums, spec.unions),
    ...generateClientOpen(spec),
    ...generateRequestFn(),
    ...generateEndpoints(spec.endpoints, modelNames),
    ...generateClientClose(),
    ...generatePaginateFn(),
    ...generateMockFactories(spec.models, spec.endpoints, spec.enums, spec.unions),
    ...generateMockClientOpen(),
    ...generateMockEndpoints(spec.endpoints),
    ...generateMockClientClose(),
  ];

  const outputPath = path.join(outputDir, "index.ts");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ TypeScript SDK generated at: ${outputPath}`);
}