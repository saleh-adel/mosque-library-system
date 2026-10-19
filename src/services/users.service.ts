import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';
import { Prisma } from '@prisma/client';

export interface UserFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  mosqueId?: string;
  isActive?: boolean;
}

export class UsersService {
  /**
   * جلب المستخدمين مع فلاتر الدور والمسجد والبحث
   */
  static async getUsers(params: UserFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.usersWhereInput = {};

    if (params.role) where.role = params.role;
    if (params.mosqueId) where.mosque_id = params.mosqueId;
    if (params.isActive !== undefined) where.is_active = params.isActive;

    if (params.search) {
      where.OR = [
        { full_name: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
        { membership_number: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          username: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          membership_number: true,
          is_active: true,
          created_at: true,
          mosque_id: true,
          mosques: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          _count: {
            select: {
              loans_loans_user_idTousers: { where: { status: 'active' } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * جلب بيانات مستخدم محدد
   */
  static async getUserById(id: string) {
    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        membership_number: true,
        is_active: true,
        created_at: true,
        mosques: true,
        loans_loans_user_idTousers: {
          orderBy: { loan_date: 'desc' },
          take: 10,
          include: {
            book_copies: {
              include: { books: true },
            },
          },
        },
      },
    });
  }

  /**
   * إنشاء مستخدم جديد مع التحقق من شروط أمين المكتبة
   */
  static async createUser(data: {
    role: UserRole;
    username: string;
    fullName: string;
    passwordHash: string;
    mosqueId?: string;
    email?: string;
    phone?: string;
    membershipNumber?: string;
  }) {
    if (data.role === 'librarian' && !data.mosqueId) {
      throw new Error('أمين المكتبة يجب أن يكون مرتبطاً بمسجد محدد (قيد chk_librarian_requires_mosque)');
    }

    return prisma.users.create({
      data: {
        role: data.role,
        username: data.username.trim().toLowerCase(),
        full_name: data.fullName.trim(),
        password_hash: data.passwordHash,
        mosque_id: data.mosqueId || null,
        email: data.email?.trim().toLowerCase() || null,
        phone: data.phone?.trim() || null,
        membership_number: data.membershipNumber?.trim() || null,
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        membership_number: true,
        is_active: true,
        mosque_id: true,
      },
    });
  }
}
