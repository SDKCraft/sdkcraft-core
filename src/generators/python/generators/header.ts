import { ApiSpec } from "../../../parsers/openapi-parser";
/**
 * يبني الجزء العلوي من ملف sdk.py: imports أساسية + تعليق الترويسة.
 * `from __future__ import annotations` لازم يكون أول statement بالملف (بعد أي تعليقات
 * فقط) — بيخلي كل الـ type hints تتقيّم كنصوص مؤجلة (lazy)، وده بيحل تلقائيًا مشكلة
 * ترتيب التعريفات ودورات الاعتماد (A بيعتمد على B وB بيعتمد على A) بدون أي حاجة
 * لـ topological sort يدوي زي اللي عملناه في zod-schemas.ts بـ TypeScript — pydantic
 * v2 بيأجل حل الـ forward refs لحد أول استخدام فعلي للموديل وقت الـ runtime.
 * hasModels بيتحكم في استيراد pydantic. hasEnums بيتحكم في استيراد Enum.
 */
export function generatePyHeader(spec: ApiSpec, hasModels: boolean, hasEnums: boolean = false): string[] {
  const lines: string[] = [];
  lines.push(`from __future__ import annotations`);
  lines.push(``);
  lines.push(`# Auto-generated SDK for ${spec.title} v${spec.version}`);
  lines.push(`# Do not edit manually`);
  lines.push(``);
  lines.push(`import time`);
  lines.push(`from typing import Any, List, Optional, Union, Literal`);
  lines.push(`import requests`);
  if (hasEnums) {
    lines.push(`from enum import Enum`);
  }
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
