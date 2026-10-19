import { prisma } from '@/lib/prisma';
import { CopyCondition, CopyStatus } from '@/types';
import { Prisma } from '@prisma/client';

export interface CopyFilterParams {
  page?: number;
  limit?: number;
  mosqueId?: string;
  bookId?: string;
  barcode?: string;
  status?: CopyStatus;
  condition?: CopyCondition;
}

export class CopiesService {
  /**
   * جلب نسخ الكتب مع فلاتر المسجد والحالة والباركود
   */
  static async getCopies(params: CopyFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.book_copiesWhereInput = { is_archived: false };

    if (params.mosqueId) where.mosque_id = params.mosqueId;
    if (params.bookId) where.book_id = params.bookId;
    if (params.status) where.status = params.status;
    if (params.condition) where.condition = params.condition;
    if (params.barcode) {
      where.barcode = { contains: params.barcode.trim(), mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      prisma.book_copies.count({ where }),
      prisma.book_copies.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          books: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              category: true,
            },
          },
          mosques: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
            },
          },
          loans: {
            where: { status: 'active' },
            take: 1,
            select: {
              id: true,
              due_date: true,
              users_loans_user_idTousers: {
                select: {
                  id: true,
                  full_name: true,
                  membership_number: true,
                },
              },
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
   * جلب نسخة بواسطة المعرف
   */
  static async getCopyById(id: string) {
    return prisma.book_copies.findUnique({
      where: { id },
      include: {
        books: true,
        mosques: true,
        loans: {
          orderBy: { loan_date: 'desc' },
          take: 10,
          include: {
            users_loans_user_idTousers: {
              select: {
                id: true,
                full_name: true,
                membership_number: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * إضافة نسخة جديدة لمسجد محدد مع التحقق من عدم تكرار الباركود في نفس المسجد
   */
  static async createCopy(data: {
    bookId: string;
    mosqueId: string;
    barcode: string;
    shelfLocation?: string;
    condition?: CopyCondition;
    notes?: string;
  }) {
    // التحقق من وجود الكتاب والمسجد
    const [book, mosque] = await Promise.all([
      prisma.books.findUnique({ where: { id: data.bookId } }),
      prisma.mosques.findUnique({ where: { id: data.mosqueId } }),
    ]);

    if (!book) throw new Error('الكتاب المحدد غير موجود');
    if (!mosque) throw new Error('المسجد المحدد غير موجود');

    return prisma.book_copies.create({
      data: {
        book_id: data.bookId,
        mosque_id: data.mosqueId,
        barcode: data.barcode.trim(),
        shelf_location: data.shelfLocation?.trim() || null,
        condition: data.condition || 'good',
        status: 'available',
        notes: data.notes?.trim() || null,
      },
      include: {
        books: true,
        mosques: true,
      },
    });
  }

  /**
   * تحديث بيانات النسخة (الحالة أو الرف أو تقييم سلامة النسخة)
   */
  static async updateCopy(
    id: string,
    data: {
      shelfLocation?: string;
      condition?: CopyCondition;
      status?: CopyStatus;
      notes?: string;
    }
  ) {
    return prisma.book_copies.update({
      where: { id },
      data: {
        shelf_location: data.shelfLocation?.trim(),
        condition: data.condition,
        status: data.status,
        notes: data.notes?.trim(),
      },
    });
  }
}
