import { NextRequest } from 'next/server';

/**
 * استخراج بارامترات التصفح والبحث من رابط الطلب
 */
export function parsePaginationParams(request: NextRequest): {
  page: number;
  limit: number;
  skip: number;
  search: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
} {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));
  const skip = (page - 1) * limit;
  const search = (searchParams.get('search') || '').trim();
  const sortBy = searchParams.get('sortBy') || undefined;
  const sortOrder = (searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  return { page, limit, skip, search, sortBy, sortOrder };
}

/**
 * التحقق من صحة صيغة المعرف UUID
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
