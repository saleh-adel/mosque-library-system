import { prisma } from '@/lib/prisma';
import { SyncOperation, SyncStatus } from '@/types';
import { Prisma } from '@prisma/client';

export interface SyncFilterParams {
  page?: number;
  limit?: number;
  nodeId?: string;
  tableName?: string;
  status?: SyncStatus;
}

export class SyncService {
  /**
   * جلب سجلات المزامنة دون اتصال
   */
  static async getSyncJournal(params: SyncFilterParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.sync_journalWhereInput = {};

    if (params.nodeId) where.node_id = params.nodeId;
    if (params.tableName) where.table_name = params.tableName;
    if (params.status) where.sync_status = params.status;

    const [total, items] = await Promise.all([
      prisma.sync_journal.count({ where }),
      prisma.sync_journal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurred_at: 'desc' },
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
   * تسجيل عملية مزامنة جديدة قادمة من محطة طرفية
   */
  static async recordSyncEvent(data: {
    nodeId: string;
    tableName: string;
    recordId: string;
    operation: SyncOperation;
    payload?: Prisma.InputJsonValue;
    syncStatus?: SyncStatus;
  }) {
    return prisma.sync_journal.create({
      data: {
        node_id: data.nodeId.trim(),
        table_name: data.tableName.trim(),
        record_id: data.recordId,
        operation: data.operation,
        payload: data.payload ?? Prisma.JsonNull,
        sync_status: data.syncStatus || 'pending',
      },
    });
  }
}
