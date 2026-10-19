import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface BookFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  author?: string;
  includeArchived?: boolean;
}

export class BooksService {
  /**
   * جلب فهرس الكتب مع البحث الذكي في العنوان والمؤلف والتصنيف والترقيم الدولي
   */
  static async getBooks(params: BookFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.booksWhereInput = {};

    if (!params.includeArchived) {
      where.is_archived = false;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { author: { contains: params.search, mode: 'insensitive' } },
        { isbn: { contains: params.search, mode: 'insensitive' } },
        { publisher: { contains: params.search, mode: 'insensitive' } },
        { category: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.category) {
      where.category = { equals: params.category, mode: 'insensitive' };
    }

    if (params.author) {
      where.author = { contains: params.author, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      prisma.books.count({ where }),
      prisma.books.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              book_copies: true,
              ebook_files: true,
            },
          },
          book_copies: {
            select: {
              id: true,
              barcode: true,
              status: true,
              condition: true,
              shelf_location: true,
              mosque_id: true,
              mosques: {
                select: {
                  id: true,
                  name: true,
                  city: true,
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
   * جلب تفاصيل كتاب محدد مع نسخه الموزعة على المساجد وملفاته الإلكترونية
   */
  static async getBookById(id: string) {
    return prisma.books.findUnique({
      where: { id },
      include: {
        book_copies: {
          include: {
            mosques: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
              },
            },
            loans: {
              where: { status: 'active' },
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
        },
        ebook_files: true,
      },
    });
  }

  /**
   * إضافة كتاب جديد إلى الفهرس المركزي
   */
  static async createBook(data: {
    title: string;
    author: string;
    isbn?: string;
    publisher?: string;
    publication_year?: number;
    edition?: string;
    category?: string;
    dewey_decimal?: string;
    language?: string;
    page_count?: number;
    description?: string;
  }) {
    return prisma.books.create({
      data: {
        title: data.title.trim(),
        author: data.author.trim(),
        isbn: data.isbn?.trim() || null,
        publisher: data.publisher?.trim() || null,
        publication_year: data.publication_year ? Number(data.publication_year) : null,
        edition: data.edition?.trim() || null,
        category: data.category?.trim() || null,
        dewey_decimal: data.dewey_decimal?.trim() || null,
        language: data.language?.trim() || 'ar',
        page_count: data.page_count ? Number(data.page_count) : null,
        description: data.description?.trim() || null,
      },
    });
  }

  /**
   * تعديل بيانات كتاب
   */
  static async updateBook(
    id: string,
    data: {
      title?: string;
      author?: string;
      isbn?: string;
      publisher?: string;
      publication_year?: number;
      edition?: string;
      category?: string;
      dewey_decimal?: string;
      language?: string;
      page_count?: number;
      description?: string;
    }
  ) {
    return prisma.books.update({
      where: { id },
      data,
    });
  }

  /**
   * أرشفة كتاب (حذف منطقي آمن وفق شروط قاعدة البيانات)
   */
  static async archiveBook(id: string, reason: string) {
    return prisma.books.update({
      where: { id },
      data: {
        is_archived: true,
        archived_at: new Date(),
        archive_reason: reason.trim(),
      },
    });
  }
}
