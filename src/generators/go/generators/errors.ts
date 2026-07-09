/**
 * يبني struct SDKError اللي بيطبّق error interface بتاع Go (method Error() string).
 * بيحمل StatusCode وBody وIsRetryable، عشان المستخدم يقدر يعمل type assertion:
 * if sdkErr, ok := err.(*sdk.SDKError); ok { ... }
 */
export function generateGoErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`type SDKError struct {`);
  lines.push(`  Message     string`);
  lines.push(`  StatusCode  int`);
  lines.push(`  Body        []byte`);
  lines.push(`  IsRetryable bool`);
  lines.push(`}\n`);

  lines.push(`func (e *SDKError) Error() string {`);
  lines.push(`  return e.Message`);
  lines.push(`}\n`);

  return lines;
}
