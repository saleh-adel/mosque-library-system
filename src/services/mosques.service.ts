import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface MosqueFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  isActive?: boolean;
}

export class MosquesService {
  /**
   * جلب قائمة المساجد مع دعم البحث والتصفح والإحصائيات لكل مسجد
   */
  static async getMosques(params: MosqueFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.mosquesWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { city: { contains: params.search, mode: 'insensitive' } },
        { district: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.city) {
      where.city = { contains: params.city, mode: 'insensitive' };
    }

    if (params.isActive !== undefined) {
      where.is_active = params.isActive;
    }

    const [total, items] = await Promise.all([
      prisma.mosques.count({ where }),
      prisma.mosques.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              book_copies: true,
              loans: { where: { status: 'active' } },
              users: true,
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
   * جلب تفاصيل مسجد محدد مع عدد النسخ والإعارات
   */
  static async getMosqueById(id: string) {
    return prisma.mosques.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            book_copies: true,
            loans: true,
            users: true,
          },
        },
      },
    });
  }

  /**
   * إنشاء مسجد جديد
   */
  static async createMosque(data: {
    code: string;
    name: string;
    city: string;
    district?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) {
    return prisma.mosques.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        city: data.city.trim(),
        district: data.district?.trim(),
        address: data.address?.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim(),
      },
    });
  }

  /**
   * تعديل بيانات مسجد
   */
  static async updateMosque(
    id: string,
    data: {
      name?: string;
      city?: string;
      district?: string;
      address?: string;
      phone?: string;
      email?: string;
      is_active?: boolean;
    }
  ) {
    return prisma.mosques.update({
      where: { id },
      data,
    });
  }
}
