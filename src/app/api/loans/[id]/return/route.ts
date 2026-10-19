import { NextRequest } from 'next/server';
import { LoansService } from '@/services/loans.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف الإعارة غير صالح (UUID)', 400);
    }

    const body = await request.json();

    if (!body.receivedBy) {
      return jsonError('حقل معرف الموظف المستلم (receivedBy) مطلوب لإتمام الإرجاع.', 400);
    }

    if (!isValidUuid(body.receivedBy)) {
      return jsonError('معرف الموظف المستلم غير صالح (UUID)', 400);
    }

    const returnedLoan = await LoansService.returnBook(id, body.receivedBy, body.notes);

    return jsonSuccess(returnedLoan, undefined, 'تم تسجيل إرجاع الكتاب بنجاح وإتاحته للإعارة مجدداً');
  } catch (error) {
    return handleApiError(error);
  }
}

