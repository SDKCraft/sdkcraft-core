import { ApiSpec } from "../../../parsers/openapi-parser";

/**
 * يبني الجزء العلوي من ملف sdk.py: imports أساسية + تعليق الترويسة.
 * hasModels بيتحكم في استيراد pydantic (لازم يكون فقط لو فيه models فعليًا).
 */
export function generatePyHeader(spec: ApiSpec, hasModels: boolean): string[] {
  const lines: string[] = [];

  lines.push(`# Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`# Do not edit manually`);
  lines.push(``);
  lines.push(`import time`);
  lines.push(`from typing import Any, List, Optional`);
  lines.push(`import requests`);
  if (hasModels) {
    lines.push(`from pydantic import BaseModel`);
  }
  lines.push(``);

  return lines;
}

/**
 * يبني فتح كلاس Client مع constructor لاستقبال base_url/api_key/bearer_token،
 * وبيهيّئ requests.Session() لإعادة استخدام الاتصال (connection pooling).
 */
export function generatePyClientOpen(spec: ApiSpec): string[] {
  const lines: string[] = [];

  lines.push(`class Client:`);
  lines.push(`    def __init__(self, base_url: str = "${spec.baseUrl}", api_key: Optional[str] = None, bearer_token: Optional[str] = None):`);
  lines.push(`        self.base_url = base_url`);
  lines.push(`        self.api_key = api_key`);
  lines.push(`        self.bearer_token = bearer_token`);
  lines.push(`        self.session = requests.Session()`);
  lines.push(``);

  return lines;
}

/** إغلاق الكلاس (سطر فاضي فقط للفصل) */
export function generatePyClientClose(): string[] {
  return [``];
}
