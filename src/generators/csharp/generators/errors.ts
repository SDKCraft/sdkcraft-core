/**
 * يبني SDKException — استثناء مخصص بيحمل StatusCode وBody الاستجابة،
 * بدل الاعتماد على HttpRequestException العام بلا سياق.
 */
export function generateCsErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`public class SDKException : Exception`);
  lines.push(`{`);
  lines.push(`    public int StatusCode { get; }`);
  lines.push(`    public string? Body { get; }`);
  lines.push(`    public bool IsRetryable { get; }\n`);

  lines.push(`    public SDKException(string message, int statusCode, string? body, bool isRetryable) : base(message)`);
  lines.push(`    {`);
  lines.push(`        StatusCode = statusCode;`);
  lines.push(`        Body = body;`);
  lines.push(`        IsRetryable = isRetryable;`);
  lines.push(`    }`);
  lines.push(`}\n`);

  return lines;
}
