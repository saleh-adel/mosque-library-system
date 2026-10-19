import { NextRequest } from 'next/server';
import { EbooksService } from '@/services/ebooks.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams, isValidUuid } from '@/lib/validation';
import { EbookFormat } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);

    const bookId = searchParams.get('bookId') || undefined;
    const isPublicParam = searchParams.get('isPublic');
    const isPublic = isPublicParam !== null ? isPublicParam === 'true' : undefined;

    const { items, meta } = await EbooksService.getEbooks({
      page,
      limit,
      bookId,
      isPublic,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.bookId || !body.fileName || !body.filePath || !body.fileFormat || !body.fileSizeBytes) {
      return jsonError('الحقول (bookId, fileName, filePath, fileFormat, fileSizeBytes) مطلوبة.', 400);
    }

    if (!isValidUuid(body.bookId)) {
      return jsonError('معرف الكتاب غير صالح (UUID)', 400);
    }

    const newEbook = await EbooksService.createEbook({
      bookId: body.bookId,
      fileName: body.fileName,
      filePath: body.filePath,
      fileFormat: body.fileFormat as EbookFormat,
      fileSizeBytes: body.fileSizeBytes,
      checksumSha256: body.checksumSha256,
      isPublic: body.isPublic,
      uploadedBy: body.uploadedBy,
    });

    return jsonSuccess(newEbook, undefined, 'تم تسجيل ملف الكتاب الإلكتروني بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

