// 对外的错误只带代码和参数，由控制面板按当前语言翻译（public/i18n 里的 error.*）
export class AppError extends Error {
  constructor(code, params = {}, status = 400) {
    super(code);
    this.code = code;
    this.params = params;
    this.status = status;
  }
}

/** 把任意错误转成 { code, params }，未知错误统一为 internal。 */
export function describeError(err) {
  if (err instanceof AppError) return { code: err.code, params: err.params };
  return { code: 'internal', params: { message: err?.message ?? String(err) } };
}
