import { NextRequest } from 'next/server';
import { SyncService } from '@/services/sync.service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/response';
import { parsePaginationParams, isValidUuid } from '@/lib/validation';
import { SyncOperation, SyncStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parsePaginationParams(request);
    const { searchParams } = new URL(request.url);

    const nodeId = searchParams.get('nodeId') || undefined;
    const tableName = searchParams.get('tableName') || undefined;
    const status = (searchParams.get('status') as SyncStatus) || undefined;

    const { items, meta } = await SyncService.getSyncJournal({
      page,
      limit,
      nodeId,
      tableName,
      status,
    });

    return jsonSuccess(items, meta);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.nodeId || !body.tableName || !body.recordId || !body.operation) {
      return jsonError('الحقول (nodeId, tableName, recordId, operation) مطلوبة.', 400);
    }

    if (!isValidUuid(body.recordId)) {
      return jsonError('معرف السجل recordId غير صالح (UUID)', 400);
    }

    const recorded = await SyncService.recordSyncEvent({
      nodeId: body.nodeId,
      tableName: body.tableName,
      recordId: body.recordId,
      operation: body.operation as SyncOperation,
      payload: body.payload,
      syncStatus: body.syncStatus,
    });

    return jsonSuccess(recorded, undefined, 'تم قيد عملية المزامنة بنجاح في سجل العمليات', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

