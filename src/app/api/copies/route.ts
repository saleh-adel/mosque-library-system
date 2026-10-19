import { NextRequest } from 'next/server';
import { CopiesService } from '@/services/copies.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams, isValidUuid } from '@/lib/validation';
import { CopyCondition, CopyStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);

    const mosqueId = searchParams.get('mosqueId') || undefined;
    const bookId = searchParams.get('bookId') || undefined;
    const barcode = searchParams.get('barcode') || undefined;
    const status = (searchParams.get('status') as CopyStatus) || undefined;
    const condition = (searchParams.get('condition') as CopyCondition) || undefined;

    const { items, meta } = await CopiesService.getCopies({
      page,
      limit,
      mosqueId,
      bookId,
      barcode,
      status,
      condition,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.bookId || !body.mosqueId || !body.barcode) {
      return jsonError('الحقول (bookId, mosqueId, barcode) مطلوبة لإنشاء النسخة.', 400);
    }

    if (!isValidUuid(body.bookId) || !isValidUuid(body.mosqueId)) {
      return jsonError('معرف الكتاب أو المسجد غير صالح (UUID)', 400);
    }

    const newCopy = await CopiesService.createCopy({
      bookId: body.bookId,
      mosqueId: body.mosqueId,
      barcode: body.barcode,
      shelfLocation: body.shelfLocation,
      condition: body.condition,
      notes: body.notes,
    });

    return jsonSuccess(newCopy, undefined, 'تم تسجيل النسخة وإضافتها لرف المسجد بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

