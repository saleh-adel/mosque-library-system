import { NextRequest } from 'next/server';
import { MosquesService } from '@/services/mosques.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف المسجد غير صالح (يجب أن يكون بصيغة UUID)', 400);
    }

    const mosque = await MosquesService.getMosqueById(id);

    if (!mosque) {
      return jsonError('المسجد المطلوب غير موجود', 404);
    }

    return jsonSuccess(mosque);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف المسجد غير صالح (يجب أن يكون بصيغة UUID)', 400);
    }

    const body = await request.json();

    const updated = await MosquesService.updateMosque(id, {
      name: body.name,
      city: body.city,
      district: body.district,
      address: body.address,
      phone: body.phone,
      email: body.email,
      is_active: body.is_active,
    });

    return jsonSuccess(updated, undefined, 'تم تحديث بيانات المسجد بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

