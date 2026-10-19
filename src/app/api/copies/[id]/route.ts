import { NextRequest } from 'next/server';
import { CopiesService } from '@/services/copies.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف النسخة غير صالح (UUID)', 400);
    }

    const copy = await CopiesService.getCopyById(id);

    if (!copy) {
      return jsonError('النسخة المطلوبة غير موجودة', 404);
    }

    return jsonSuccess(copy);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف النسخة غير صالح (UUID)', 400);
    }

    const body = await request.json();

    const updated = await CopiesService.updateCopy(id, {
      shelfLocation: body.shelfLocation,
      condition: body.condition,
      status: body.status,
      notes: body.notes,
    });

    return jsonSuccess(updated, undefined, 'تم تعديل بيانات النسخة بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

