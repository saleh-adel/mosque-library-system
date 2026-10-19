import { LoansService } from '@/services/loans.service';
import { jsonSuccess, handleApiError } from '@/lib/response';

export async function GET() {
  try {
    const overdueLoans = await LoansService.getOverdueLoans();
    return jsonSuccess(overdueLoans);
  } catch (error) {
    return handleApiError(error);
  }
}

