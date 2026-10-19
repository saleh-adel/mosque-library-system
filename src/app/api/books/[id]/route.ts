import { NextRequest } from 'next/server';
import { BooksService } from '@/services/books.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { isValidUuid } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف الكتاب غير صالح (UUID)', 400);
    }

    const book = await BooksService.getBookById(id);

    if (!book) {
      return jsonError('الكتاب المطلوب غير موجود', 404);
    }

    return jsonSuccess(book);
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
      return jsonError('معرف الكتاب غير صالح (UUID)', 400);
    }

    const body = await request.json();

    const updated = await BooksService.updateBook(id, body);

    return jsonSuccess(updated, undefined, 'تم تعديل بيانات الكتاب بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return jsonError('معرف الكتاب غير صالح (UUID)', 400);
    }

    let reason = 'سحب من التداول العام';
    try {
      const body = await request.json();
      if (body.reason) reason = body.reason;
    } catch {
      // Body is optional
    }

    const archived = await BooksService.archiveBook(id, reason);

    return jsonSuccess(archived, undefined, 'تم أرشفة الكتاب بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

