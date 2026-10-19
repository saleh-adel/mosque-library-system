import { NextRequest } from 'next/server';
import { LoansService } from '@/services/loans.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف الإعارة غير صالح (UUID)', 400);
    }

    const loan = await LoansService.getLoanById(id);

    if (!loan) {
      return jsonError('سجل الإعارة المطلوب غير موجود', 404);
    }

    return jsonSuccess(loan);
  } catch (error) {
    return handleApiError(error);
  }
}

