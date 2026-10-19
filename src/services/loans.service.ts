import { prisma } from '@/lib/prisma';
import { LoanStatus } from '@/types';
import { Prisma } from '@prisma/client';

export interface LoanFilterParams {
  page?: number;
  limit?: number;
  mosqueId?: string;
  userId?: string;
  copyId?: string;
  status?: LoanStatus;
}

export class LoansService {
  /**
   * جلب سجلات الإعارة مع فلاتر المسجد والمستعير والحالة
   */
  static async getLoans(params: LoanFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.loansWhereInput = {};

    if (params.mosqueId) where.mosque_id = params.mosqueId;
    if (params.userId) where.user_id = params.userId;
    if (params.copyId) where.copy_id = params.copyId;
    if (params.status) where.status = params.status;

    const [total, items] = await Promise.all([
      prisma.loans.count({ where }),
      prisma.loans.findMany({
        where,
        skip,
        take: limit,
        orderBy: { loan_date: 'desc' },
        include: {
          book_copies: {
            include: {
              books: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                  isbn: true,
                },
              },
            },
          },
          mosques: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          users_loans_user_idTousers: {
            select: {
              id: true,
              full_name: true,
              membership_number: true,
              phone: true,
            },
          },
          users_loans_loaned_byTousers: {
            select: {
              id: true,
              full_name: true,
              role: true,
            },
          },
          users_loans_received_byTousers: {
            select: {
              id: true,
              full_name: true,
              role: true,
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
   * جلب تفاصيل إعارة محددة
   */
  static async getLoanById(id: string) {
    return prisma.loans.findUnique({
      where: { id },
      include: {
        book_copies: {
          include: {
            books: true,
          },
        },
        mosques: true,
        users_loans_user_idTousers: true,
        users_loans_loaned_byTousers: true,
        users_loans_received_byTousers: true,
      },
    });
  }

  /**
   * تسجيل إعارة جديدة مع معالجة القيود وضمان العملية المتكاملة (Transaction)
   */
  static async borrowBook(data: {
    copyId: string;
    userId: string;
    loanedBy: string;
    dueDate: Date;
    notes?: string;
  }) {
    // 1. فحص النسخة والتأكد من وجودها ومسجدها وحالتها
    const copy = await prisma.book_copies.findUnique({
      where: { id: data.copyId },
      include: { mosques: true, books: true },
    });

    if (!copy) {
      throw new Error('النسخة المطلوبة غير موجودة.');
    }

    if (copy.status !== 'available') {
      throw new Error(`لا يمكن إعارة النسخة، حالتها الحالية: ${copy.status}`);
    }

    // 2. التحقق من المستعير
    const borrower = await prisma.users.findUnique({
      where: { id: data.userId },
    });

    if (!borrower || !borrower.is_active) {
      throw new Error('المستعير غير موجود أو حسابه غير مفعّل.');
    }

    // 3. التحقق من موظف الإعارة ومسجده
    const staff = await prisma.users.findUnique({
      where: { id: data.loanedBy },
    });

    if (!staff || !staff.is_active) {
      throw new Error('أمين المكتبة/المشرف غير موجود أو حسابه غير مفعّل.');
    }

    if (staff.role === 'librarian' && staff.mosque_id !== copy.mosque_id) {
      throw new Error('غير مصرح لأمين المكتبة بإجراء إعارة لنسخة تابعة لمسجد آخر.');
    }

    // 4. تنفيذ العملية في معاملة ذرية متسقة
    return prisma.$transaction(async (tx) => {
      // إنشاء سجل الإعارة
      const loan = await tx.loans.create({
        data: {
          copy_id: copy.id,
          mosque_id: copy.mosque_id,
          user_id: data.userId,
          loaned_by: data.loanedBy,
          loan_date: new Date(),
          due_date: data.dueDate,
          status: 'active',
          notes: data.notes?.trim() || null,
        },
        include: {
          book_copies: {
            include: { books: true },
          },
          mosques: true,
          users_loans_user_idTousers: true,
        },
      });

      // تحديث حالة النسخة إلى "مستعارة"
      await tx.book_copies.update({
        where: { id: copy.id },
        data: { status: 'borrowed' },
      });

      return loan;
    });
  }

  /**
   * استرجاع كتاب مع تحديث حالة السجل وحالة النسخة
   */
  static async returnBook(loanId: string, receivedBy: string, notes?: string) {
    const loan = await prisma.loans.findUnique({
      where: { id: loanId },
      include: { book_copies: true },
    });

    if (!loan) {
      throw new Error('سجل الإعارة غير موجود.');
    }

    if (loan.status === 'returned') {
      throw new Error('تم استرجاع هذه النسخة مسبقاً.');
    }

    // التحقق من هوية أمين المكتبة المستلم
    const staff = await prisma.users.findUnique({
      where: { id: receivedBy },
    });

    if (!staff || !staff.is_active) {
      throw new Error('الموظف المستلم غير موجود أو حسابه غير مفعّل.');
    }

    const returnDate = new Date();

    return prisma.$transaction(async (tx) => {
      // تحديث سجل الإعارة
      const updatedLoan = await tx.loans.update({
        where: { id: loanId },
        data: {
          status: 'returned',
          return_date: returnDate,
          received_by: receivedBy,
          notes: notes ? `${loan.notes ? loan.notes + ' | ' : ''}${notes}` : loan.notes,
        },
        include: {
          book_copies: {
            include: { books: true },
          },
          users_loans_user_idTousers: true,
        },
      });

      // إعادة النسخة إلى متاحة
      await tx.book_copies.update({
        where: { id: loan.copy_id },
        data: { status: 'available' },
      });

      return updatedLoan;
    });
  }

  /**
   * جلب الإعارات المتأخرة
   */
  static async getOverdueLoans() {
    const now = new Date();

    return prisma.loans.findMany({
      where: {
        status: { in: ['active', 'overdue'] },
        return_date: null,
        due_date: { lt: now },
      },
      orderBy: { due_date: 'asc' },
      include: {
        book_copies: {
          include: { books: true },
        },
        mosques: true,
        users_loans_user_idTousers: true,
      },
    });
  }
}
