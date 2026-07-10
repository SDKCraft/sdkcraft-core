/**
 * يبني SDKException — استثناء مخصص بيحمل statusCode وbody الاستجابة،
 * بدل الاعتماد على Exception عام بلا سياق.
 */
export function generateDartErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`class SDKException implements Exception {`);
  lines.push(`  final String message;`);
  lines.push(`  final int statusCode;`);
  lines.push(`  final String? body;`);
  lines.push(`  final bool isRetryable;\n`);

  lines.push(`  SDKException(this.message, this.statusCode, this.body, this.isRetryable);\n`);

  lines.push(`  @override`);
  lines.push(`  String toString() => message;`);
  lines.push(`}\n`);

  return lines;
}
