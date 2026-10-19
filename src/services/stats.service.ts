import { prisma } from '@/lib/prisma';
import { DashboardStats } from '@/types';

export class StatsService {
  /**
   * حساب كافة المؤشرات والإحصائيات التجميعية لشبكة مكتبات المساجد
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();

    const [
      totalMosques,
      activeMosques,
      totalBooks,
      totalCopies,
      availableCopies,
      borrowedCopies,
      activeLoans,
      overdueLoans,
      totalMembers,
      totalLibrarians,
      totalEbooks,
      recentLoans,
    ] = await Promise.all([
      prisma.mosques.count(),
      prisma.mosques.count({ where: { is_active: true } }),
      prisma.books.count({ where: { is_archived: false } }),
      prisma.book_copies.count({ where: { is_archived: false } }),
      prisma.book_copies.count({ where: { is_archived: false, status: 'available' } }),
      prisma.book_copies.count({ where: { status: 'borrowed' } }),
      prisma.loans.count({ where: { status: 'active', return_date: null } }),
      prisma.loans.count({
        where: {
          status: { in: ['active', 'overdue'] },
          return_date: null,
          due_date: { lt: now },
        },
      }),
      prisma.users.count({ where: { role: 'member' } }),
      prisma.users.count({ where: { role: 'librarian' } }),
      prisma.ebook_files.count(),
      prisma.loans.findMany({
        take: 5,
        orderBy: { loan_date: 'desc' },
        include: {
          book_copies: {
            include: {
              books: {
                select: {
                  title: true,
                  author: true,
                },
              },
            },
          },
          mosques: {
            select: {
              name: true,
            },
          },
          users_loans_user_idTousers: {
            select: {
              full_name: true,
              membership_number: true,
            },
          },
        },
      }),
    ]);

    return {
      totalMosques,
      activeMosques,
      totalBooks,
      totalCopies,
      availableCopies,
      borrowedCopies,
      activeLoans,
      overdueLoans,
      totalMembers,
      totalLibrarians,
      totalEbooks,
      recentLoans,
    };
  }
}

