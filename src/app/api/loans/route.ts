import { NextRequest } from 'next/server';
import { LoansService } from '@/services/loans.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams, isValidUuid } from '@/lib/validation';
import { LoanStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);

    const mosqueId = searchParams.get('mosqueId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const copyId = searchParams.get('copyId') || undefined;
    const status = (searchParams.get('status') as LoanStatus) || undefined;

    const { items, meta } = await LoansService.getLoans({
      page,
      limit,
      mosqueId,
      userId,
      copyId,
      status,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.copyId || !body.userId || !body.loanedBy || !body.dueDate) {
      return jsonError('الحقول (copyId, userId, loanedBy, dueDate) مطلوبة لإنشاء الإعارة.', 400);
    }

    if (!isValidUuid(body.copyId) || !isValidUuid(body.userId) || !isValidUuid(body.loanedBy)) {
      return jsonError('معرف النسخة أو المستعير أو الموظف غير صالح (UUID)', 400);
    }

    const dueDate = new Date(body.dueDate);
    if (isNaN(dueDate.getTime())) {
      return jsonError('تاريخ الاستحقاق (dueDate) غير صالح.', 400);
    }

    const newLoan = await LoansService.borrowBook({
      copyId: body.copyId,
      userId: body.userId,
      loanedBy: body.loanedBy,
      dueDate,
      notes: body.notes,
    });

    return jsonSuccess(newLoan, undefined, 'تم تسجيل الإعارة وتحديث حالة النسخة بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

