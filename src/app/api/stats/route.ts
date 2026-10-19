import { StatsService } from '@/services/stats.service';
import { jsonSuccess, handleApiError } from '@/lib/response';

export async function GET() {
  try {
    const stats = await StatsService.getDashboardStats();
    return jsonSuccess(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
