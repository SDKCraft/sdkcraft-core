/**
 * يبني كلاس SDKError المخصص بلغة Python — بيحمل status code وbody الاستجابة،
 * بدل الاعتماد على exceptions عامة من مكتبة requests.
 */
export function generatePyErrorClass(): string[] {
  const lines: string[] = [];

  lines.push(`class SDKError(Exception):`);
  lines.push(`    """Raised when the API returns an error response or the request fails."""`);
  lines.push(``);
  lines.push(`    def __init__(self, message: str, status: int, body=None, is_retryable: bool = False):`);
  lines.push(`        super().__init__(message)`);
  lines.push(`        self.status = status`);
  lines.push(`        self.body = body`);
  lines.push(`        self.is_retryable = is_retryable`);
  lines.push(``);

  return lines;
}
