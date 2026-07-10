/**
 * يبني SDKException — استثناء مخصص بيحمل statusCode وbody الاستجابة،
 * بدل Exception عام بلا سياق.
 */
export function generateKtErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`class SDKException(`);
  lines.push(`  message: String,`);
  lines.push(`  val statusCode: Int,`);
  lines.push(`  val body: String?,`);
  lines.push(`  val isRetryable: Boolean = false`);
  lines.push(`) : Exception(message)\n`);

  return lines;
}
