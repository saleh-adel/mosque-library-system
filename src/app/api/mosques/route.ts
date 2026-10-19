import { NextRequest } from 'next/server';
import { MosquesService } from '@/services/mosques.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { page, limit, search } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;

    const { items, meta } = await MosquesService.getMosques({
      page,
      limit,
      search,
      city,
      isActive,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.code || !body.name || !body.city) {
      return jsonError('الحقول (code, name, city) مطلوبة لإنشاء المسجد.', 400);
    }

    const newMosque = await MosquesService.createMosque({
      code: body.code,
      name: body.name,
      city: body.city,
      district: body.district,
      address: body.address,
      phone: body.phone,
      email: body.email,
    });

    return jsonSuccess(newMosque, undefined, 'تم إنشاء المسجد بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

