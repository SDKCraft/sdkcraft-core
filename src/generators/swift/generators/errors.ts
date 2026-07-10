/**
 * يبني SDKError — يطبّق بروتوكول Error، بيحمل statusCode وbody الاستجابة،
 * بدل الاعتماد على NSError أو Error عام بلا سياق.
 */
export function generateSwiftErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`struct SDKError: Error, LocalizedError {`);
  lines.push(`  let message: String`);
  lines.push(`  let statusCode: Int`);
  lines.push(`  let body: String?`);
  lines.push(`  let isRetryable: Bool\n`);

  lines.push(`  var errorDescription: String? { message }`);
  lines.push(`}\n`);

  return lines;
}
