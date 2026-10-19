import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startTime = Date.now();

  try {
    // 1. استعلام مباشر للتحقق من الاتصال واسم قاعدة البيانات الفعلية
    const rawResult = await prisma.$queryRaw<
      Array<{
        current_db: string;
        current_usr: string;
        pg_version: string;
        now_time: Date;
      }>
    >`
      SELECT 
        current_database() AS current_db,
        current_user AS current_usr,
        version() AS pg_version,
        NOW() AS now_time;
    `;

    // 2. التحقق من إمكانية قراءة الجداول السبعة الأساسية عبر Prisma
    const [
      mosquesCount,
      usersCount,
      booksCount,
      bookCopiesCount,
      ebookFilesCount,
      loansCount,
      syncJournalCount,
    ] = await Promise.all([
      prisma.mosques.count(),
      prisma.users.count(),
      prisma.books.count(),
      prisma.book_copies.count(),
      prisma.ebook_files.count(),
      prisma.loans.count(),
      prisma.sync_journal.count(),
    ]);

    const latencyMs = Date.now() - startTime;
    const dbInfo = rawResult[0];

    return NextResponse.json({
      status: 'connected',
      database: dbInfo?.current_db ?? 'unknown',
      currentUser: dbInfo?.current_usr ?? 'unknown',
      latencyMs,
      timestamp: new Date().toISOString(),
      serverTime: dbInfo?.now_time ?? null,
      engine: 'PostgreSQL',
      versionSnippet: dbInfo?.pg_version?.split(',')[0] ?? 'unknown',
      tablesVerified: {
        mosques: { status: 'accessible', count: mosquesCount },
        users: { status: 'accessible', count: usersCount },
        books: { status: 'accessible', count: booksCount },
        book_copies: { status: 'accessible', count: bookCopiesCount },
        ebook_files: { status: 'accessible', count: ebookFilesCount },
        loans: { status: 'accessible', count: loansCount },
        sync_journal: { status: 'accessible', count: syncJournalCount },
      },
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        status: 'error',
        message: 'فشل الاتصال بقاعدة البيانات PostgreSQL',
        error: errorMessage,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
