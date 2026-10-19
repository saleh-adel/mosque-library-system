import { prisma } from '@/lib/prisma';
import { EbookFormat } from '@/types';
import { Prisma } from '@prisma/client';

export interface EbookFilterParams {
  page?: number;
  limit?: number;
  bookId?: string;
  isPublic?: boolean;
}

export class EbooksService {
  /**
   * جلب ملفات الكتب الإلكترونية
   */
  static async getEbooks(params: EbookFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ebook_filesWhereInput = {};

    if (params.bookId) where.book_id = params.bookId;
    if (params.isPublic !== undefined) where.is_public = params.isPublic;

    const [total, items] = await Promise.all([
      prisma.ebook_files.count({ where }),
      prisma.ebook_files.findMany({
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
            },
          },
          users: {
            select: {
              id: true,
              full_name: true,
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
   * تسجيل ملف إلكتروني جديد للكتاب
   */
  static async createEbook(data: {
    bookId: string;
    fileName: string;
    filePath: string;
    fileFormat: EbookFormat;
    fileSizeBytes: number | bigint;
    checksumSha256?: string;
    isPublic?: boolean;
    uploadedBy?: string;
  }) {
    return prisma.ebook_files.create({
      data: {
        book_id: data.bookId,
        file_name: data.fileName.trim(),
        file_path: data.filePath.trim(),
        file_format: data.fileFormat,
        file_size_bytes: BigInt(data.fileSizeBytes),
        checksum_sha256: data.checksumSha256?.trim() || null,
        is_public: data.isPublic ?? false,
        uploaded_by: data.uploadedBy || null,
      },
    });
  }
}
