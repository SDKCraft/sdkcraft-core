import fs from "fs";
import path from "path";
import { ApiSpec } from "../parsers/openapi-parser";

import { generateHeader } from "./typescript/generators/header";
import { generateModels } from "./typescript/generators/models";
import { generateRequestFn } from "./typescript/generators/request";
import { generatePaginateFn } from "./typescript/generators/paginate";
import { generateEndpoints } from "./typescript/generators/endpoints";
import { generateErrorClass } from "./typescript/generators/errors";
import { generateZodSchemas } from "./typescript/generators/zod-schemas";

/**
 * يولّد SDK كامل بلغة TypeScript من ApiSpec، ويكتبه في outputDir/index.ts.
 *
 * الترتيب مهم: header (BASE_URL + auth) قبل request() لأنه بيستخدم BASE_URL/_apiKey/_bearerToken،
 * وmodels قبل endpoints لأن دوال الـ endpoints بترجع types معرّفة في الـ models.
 */
export function generateTypeScriptSDK(spec: ApiSpec, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [
    ...generateHeader(spec, spec.models.length > 0),
      ...generateErrorClass(),
    ...generateZodSchemas(spec.models),
    ...generateModels(spec.models),
    ...generateRequestFn(),
    ...generatePaginateFn(),
    ...generateEndpoints(spec.endpoints, new Set(spec.models.map(m => m.name))),
  ];

  const outputPath = path.join(outputDir, "index.ts");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`✅ TypeScript SDK generated at: ${outputPath}`);
}
