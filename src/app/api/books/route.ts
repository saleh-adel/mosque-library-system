import { NextRequest } from 'next/server';
import { BooksService } from '@/services/books.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { page, limit, search } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const author = searchParams.get('author') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const { items, meta } = await BooksService.getBooks({
      page,
      limit,
      search,
      category,
      author,
      includeArchived,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.author) {
      return jsonError('الحقول (title, author) مطلوبة لإنشاء الكتاب.', 400);
    }

    const newBook = await BooksService.createBook({
      title: body.title,
      author: body.author,
      isbn: body.isbn,
      publisher: body.publisher,
      publication_year: body.publication_year,
      edition: body.edition,
      category: body.category,
      dewey_decimal: body.dewey_decimal,
      language: body.language,
      page_count: body.page_count,
      description: body.description,
    });

    return jsonSuccess(newBook, undefined, 'تم إضافة الكتاب بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

