/**
 * يبني SDKException — checked exception بتحمل statusCode وbody الاستجابة،
 * بدل RuntimeException عام بلا سياق.
 */
export function generateJavaErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`class SDKException extends Exception {`);
  lines.push(`  private final int statusCode;`);
  lines.push(`  private final String body;`);
  lines.push(`  private final boolean retryable;\n`);

  lines.push(`  public SDKException(String message, int statusCode, String body, boolean retryable) {`);
  lines.push(`    super(message);`);
  lines.push(`    this.statusCode = statusCode;`);
  lines.push(`    this.body = body;`);
  lines.push(`    this.retryable = retryable;`);
  lines.push(`  }\n`);

  lines.push(`  public int getStatusCode() { return statusCode; }`);
  lines.push(`  public String getBody() { return body; }`);
  lines.push(`  public boolean isRetryable() { return retryable; }`);
  lines.push(`}\n`);

  return lines;
}
