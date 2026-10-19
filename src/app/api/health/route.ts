import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mosque-library-api',
    app: 'نظام إدارة مكتبات المساجد المترابطة',
    framework: 'Next.js App Router',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
