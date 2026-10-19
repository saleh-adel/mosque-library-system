import { NextRequest } from 'next/server';
import { UsersService } from '@/services/users.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف المستخدم غير صالح (UUID)', 400);
    }

    const user = await UsersService.getUserById(id);

    if (!user) {
      return jsonError('المستخدم المطلوب غير موجود', 404);
    }

    return jsonSuccess(user);
  } catch (error) {
    return handleApiError(error);
  }
}

