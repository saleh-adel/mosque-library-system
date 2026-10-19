// ============================================================================
// مشروع: إدارة مكتبات المساجد المترابطة (Interconnected Mosque Libraries)
// ملف: src/types/index.ts
// تعريفات النماذج والأنماط المعمارية
// ============================================================================

export type UserRole = 'admin' | 'librarian' | 'member';

export type CopyCondition = 'new' | 'good' | 'fair' | 'damaged' | 'lost';

export type CopyStatus = 'available' | 'borrowed' | 'reserved' | 'maintenance' | 'withdrawn';

export type LoanStatus = 'active' | 'returned' | 'overdue' | 'lost';

export type EbookFormat = 'pdf' | 'epub' | 'mobi' | 'docx' | 'other';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';

// ----------------------------------------------------------------------------
// واجهات الاستجابة القياسية (API Standard Responses)
// ----------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: unknown;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ----------------------------------------------------------------------------
// واجهات إحصائيات لوحة التحكم (Dashboard Statistics)
// ----------------------------------------------------------------------------

export interface RecentLoanSummary {
  id: string;
  loan_date: Date | string;
  due_date: Date | string;
  status: string;
  book_copies?: {
    books?: {
      title: string;
      author: string;
    };
  };
  mosques?: {
    name: string;
  };
  users_loans_user_idTousers?: {
    full_name: string;
    membership_number?: string | null;
  };
}

export interface DashboardStats {
  totalMosques: number;
  activeMosques: number;
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeLoans: number;
  overdueLoans: number;
  totalMembers: number;
  totalLibrarians: number;
  totalEbooks: number;
  recentLoans: RecentLoanSummary[];
}
