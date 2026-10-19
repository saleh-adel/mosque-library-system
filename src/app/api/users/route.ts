import { NextRequest } from 'next/server';
import { UsersService } from '@/services/users.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams } from '@/lib/validation';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { page, limit, search } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);

    const role = (searchParams.get('role') as UserRole) || undefined;
    const mosqueId = searchParams.get('mosqueId') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;

    const { items, meta } = await UsersService.getUsers({
      page,
      limit,
      search,
      role,
      mosqueId,
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

    if (!body.role || !body.username || !body.fullName) {
      return jsonError('الحقول (role, username, fullName) مطلوبة لإنشاء المستخدم.', 400);
    }

    if (!['admin', 'librarian', 'member'].includes(body.role)) {
      return jsonError('الدور role يجب أن يكون أحد القيم: (admin, librarian, member)', 400);
    }

    // افتراض كلمة مرور أولية مشفرة إن لم يتم توفير hash
    const passwordHash = body.passwordHash || 'hashed_default_placeholder';

    const newUser = await UsersService.createUser({
      role: body.role,
      username: body.username,
      fullName: body.fullName,
      passwordHash,
      mosqueId: body.mosqueId,
      email: body.email,
      phone: body.phone,
      membershipNumber: body.membershipNumber,
    });

    return jsonSuccess(newUser, undefined, 'تم تسجيل المستخدم بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

