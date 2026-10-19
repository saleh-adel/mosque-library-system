import { NextResponse } from 'next/server';
import { ApiResponse, PaginationMeta } from '@/types';

/**
 * إرجاع استجابة نجاح قياسية
 */
export function jsonSuccess<T>(
  data: T,
  meta?: PaginationMeta,
  message?: string,
  status: number = 200
) {
  const body: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };
  return NextResponse.json(body, { status });
}

/**
 * إرجاع استجابة خطأ قياسية
 */
export function jsonError(
  error: string,
  status: number = 400,
  details?: unknown
) {
  const body: ApiResponse = {
    success: false,
    error,
    ...(details !== undefined ? { details } : {}),
  };
  return NextResponse.json(body, { status });
}

/**
 * معالج موحد لأخطاء Prisma وقواعد البيانات
 */
export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof Error) {
    // التحقق من أخطاء قيود PostgreSQL وقواعد Prisma
    const msg = error.message;

    if (msg.includes('Unique constraint failed') || msg.includes('uq_')) {
      return jsonError('تعارض في البيانات: يوجد سجل بنفس المعرف أو الباركود مسبقاً.', 409, msg);
    }

    if (msg.includes('Foreign key constraint') || msg.includes('fk_')) {
      return jsonError('فشل التحقق من صحة العلاقات: السجل المرتبط غير موجود أو مقيد.', 400, msg);
    }

    if (msg.includes('chk_') || msg.includes('Check constraint')) {
      return jsonError('فشل التحقق من القيود المنطقية للبيانات المدخلة.', 422, msg);
    }

    return jsonError(msg, 500);
  }

  return jsonError('حدث خطأ غير متوقع في الخادم', 500);
}
