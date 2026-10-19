'use client';

import React, { useState, useEffect } from 'react';
import { RecentLoanSummary } from '@/types';

export type TabType = 'overview' | 'books' | 'copies' | 'loans' | 'mosques' | 'api' | 'health';

interface Stats {
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

interface Mosque {
  id: string;
  code: string;
  name: string;
  city: string;
  district?: string;
  phone?: string;
  _count?: {
    book_copies: number;
    loans: number;
    users: number;
  };
}

interface Book {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  publication_year?: number;
  category?: string;
  language: string;
  _count?: {
    book_copies: number;
    ebook_files: number;
  };
  book_copies?: Array<{
    id: string;
    barcode: string;
    status: string;
    condition: string;
    shelf_location?: string;
    mosques?: { name: string; city: string };
  }>;
}

interface Copy {
  id: string;
  barcode: string;
  shelf_location?: string;
  condition: string;
  status: string;
  books: {
    id: string;
    title: string;
    author: string;
    isbn?: string;
    category?: string;
  };
  mosques: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  loans?: Array<{
    id: string;
    due_date: string;
    users_loans_user_idTousers: { full_name: string; membership_number?: string };
  }>;
}

interface TableVerification {
  status: string;
  count: number;
}

interface DbHealth {
  status: string;
  database?: string;
  currentUser?: string;
  latencyMs?: number;
  tablesVerified?: Record<string, TableVerification>;
  error?: string;
}

interface Loan {
  id: string;
  loaned_by?: string;
  loan_date: string;
  due_date: string;
  return_date?: string;
  status: string;
  book_copies: {
    barcode: string;
    books: { title: string; author: string };
  };
  mosques: { name: string; code: string };
  users_loans_user_idTousers: { full_name: string; membership_number?: string; phone?: string };
  users_loans_loaned_byTousers: { full_name: string };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);

  // البيانات لكل تبويب
  const [books, setBooks] = useState<Book[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [mosques, setMosques] = useState<Mosque[]>([]);

  // فلاتر البحث
  const [bookSearch, setBookSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');

  // استجابة فاحص الـ API
  const [apiResult, setApiResult] = useState<{ endpoint: string; status: number; data: unknown } | null>(null);
  const [apiTesting, setApiTesting] = useState(false);

  // رسائل إشعار
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInitialData = () => {
    Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/db-health').then((r) => r.json()),
    ])
      .then(([statsRes, healthRes]) => {
        if (statsRes.success) {
          setStats(statsRes.data);
        }
        setDbHealth(healthRes);
      })
      .catch((e) => console.error(e));
  };

  // جلب الإحصائيات الأولية
  useEffect(() => {
    fetchInitialData();
  }, []);

  // تحميل بيانات التبويب عند تفعيله
  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'books') {
      fetch(`/api/books?search=${encodeURIComponent(bookSearch)}&limit=20`)
        .then((r) => r.json())
        .then((res) => {
          if (isMounted && res.success) setBooks(res.data);
        })
        .catch((e) => console.error(e));
    } else if (activeTab === 'copies') {
      fetch(`/api/copies?barcode=${encodeURIComponent(copySearch)}&limit=20`)
        .then((r) => r.json())
        .then((res) => {
          if (isMounted && res.success) setCopies(res.data);
        })
        .catch((e) => console.error(e));
    } else if (activeTab === 'loans') {
      fetch('/api/loans?limit=30')
        .then((r) => r.json())
        .then((res) => {
          if (isMounted && res.success) setLoans(res.data);
        })
        .catch((e) => console.error(e));
    } else if (activeTab === 'mosques') {
      fetch('/api/mosques?limit=30')
        .then((r) => r.json())
        .then((res) => {
          if (isMounted && res.success) setMosques(res.data);
        })
        .catch((e) => console.error(e));
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, bookSearch, copySearch]);

  const loadBooks = () => {
    fetch(`/api/books?search=${encodeURIComponent(bookSearch)}&limit=20`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setBooks(res.data);
      })
      .catch((e) => console.error(e));
  };

  const loadCopies = () => {
    fetch(`/api/copies?barcode=${encodeURIComponent(copySearch)}&limit=20`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCopies(res.data);
      })
      .catch((e) => console.error(e));
  };

  const loadLoans = () => {
    fetch('/api/loans?limit=30')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setLoans(res.data);
      })
      .catch((e) => console.error(e));
  };

  const loadMosques = () => {
    fetch('/api/mosques?limit=30')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setMosques(res.data);
      })
      .catch((e) => console.error(e));
  };

  // تنفيذ استرجاع كتاب
  const handleReturnLoan = async (loanId: string, receivedByUserId: string) => {
    try {
      const res = await fetch(`/api/loans/${loanId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedBy: receivedByUserId, notes: 'تم الإرجاع بنجاح عبر النظام' }),
      }).then((r) => r.json());

      if (res.success) {
        showToast('تم تسجيل إرجاع النسخة وإعادتها لحالة متاح بنجاح!');
        loadLoans();
        fetchInitialData();
      } else {
        showToast(res.error || 'حدث خطأ أثناء الإرجاع', 'error');
      }
    } catch {
      showToast('فشل الاتصال بالخادم', 'error');
    }
  };

  // أداة فحص واجهات البرمجة API Tester
  const testEndpoint = async (url: string, method: string = 'GET', bodyData?: unknown) => {
    setApiTesting(true);
    setApiResult(null);
    try {
      const options: RequestInit = { method };
      if (bodyData) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(bodyData);
      }
      const response = await fetch(url, options);
      const data = await response.json();
      setApiResult({
        endpoint: `${method} ${url}`,
        status: response.status,
        data,
      });
    } catch (err: unknown) {
      setApiResult({
        endpoint: `${method} ${url}`,
        status: 500,
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      setApiTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* الإشعار العائم Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-medium flex items-center gap-3 transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 border border-emerald-400' : 'bg-rose-600 border border-rose-400'
          }`}
        >
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* الشريط العلوي Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/20">
              🕌
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                منظومة مكتبات المساجد المترابطة
              </h1>
              <p className="text-xs text-slate-400">
                Interconnected Mosque Libraries Management System (PostgreSQL + Next.js App Router API)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {dbHealth?.status === 'connected' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                قاعدة البيانات متصلة ({dbHealth.database})
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                في انتظار تكوين الاتصال المحلي
              </span>
            )}

            <button
              onClick={() => setActiveTab('api')}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20"
            >
              مستكشف الـ API ⚡
            </button>
          </div>
        </div>

        {/* شريط التبويبات Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-2 border-t border-slate-800/60 pt-2 pb-1 scrollbar-none">
          {[
            { id: 'overview', label: 'لوحة المؤشرات العامة', icon: '📊' },
            { id: 'books', label: 'فهرس الكتب والعناوين', icon: '📚' },
            { id: 'copies', label: 'النسخ والباركود بالمساجد', icon: '🏷️' },
            { id: 'loans', label: 'حركة الإعارة والاسترجاع', icon: '🔄' },
            { id: 'mosques', label: 'شبكة المساجد التابعة', icon: '🏛️' },
            { id: 'api', label: 'دليل وفاحص الـ API', icon: '⚡' },
            { id: 'health', label: 'صحة الاتصال والبيئة', icon: '🩺' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/70 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* المحتوى الرئيسي Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* التبويب 1: لوحة المؤشرات Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* بطاقات الإحصائيات العلوية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">شبكة المساجد المفعلة</p>
                    <h3 className="text-3xl font-black mt-2 text-white">
                      {stats ? stats.activeMosques : '0'}
                      <span className="text-xs font-normal text-slate-400 mr-2">من {stats?.totalMosques ?? 0}</span>
                    </h3>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-2xl">🏛️</div>
                </div>
                <div className="mt-4 text-xs text-emerald-400 font-medium">مترابطة عبر رقم إصدار المزامنة</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 shadow-lg relative overflow-hidden group hover:border-teal-500/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">عناوين الكتب المركزية</p>
                    <h3 className="text-3xl font-black mt-2 text-white">{stats ? stats.totalBooks : '0'}</h3>
                  </div>
                  <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl text-2xl">📚</div>
                </div>
                <div className="mt-4 text-xs text-teal-400 font-medium">فهرس عام موحد لجميع المساجد</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">النسخ الورقية المتاحة</p>
                    <h3 className="text-3xl font-black mt-2 text-white">
                      {stats ? stats.availableCopies : '0'}
                      <span className="text-xs font-normal text-slate-400 mr-2">من {stats?.totalCopies ?? 0}</span>
                    </h3>
                  </div>
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl text-2xl">🏷️</div>
                </div>
                <div className="mt-4 text-xs text-cyan-400 font-medium">موزعة مع فرادة الباركود لكل مسجد</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">الإعارات الجارية</p>
                    <h3 className="text-3xl font-black mt-2 text-white">
                      {stats ? stats.activeLoans : '0'}
                      {stats && stats.overdueLoans > 0 && (
                        <span className="text-xs text-rose-400 mr-2">({stats.overdueLoans} متأخرة)</span>
                      )}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl text-2xl">🔄</div>
                </div>
                <div className="mt-4 text-xs text-amber-400 font-medium">مضبوطة بقيد منع تكرار إعارة النسخة</div>
              </div>
            </div>

            {/* تفاصيل المعمارية والبيئة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ملخص المعمارية التقنية */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🏗️</span>
                  معمارية البناء المتكاملة (Clean Layered Architecture)
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  تم تصميم هيكل النظام بحيث يفصل منطق الأعمال والتحقق من قيود قاعدة البيانات عن واجهات العرض ومسارات الـ API:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-emerald-400 font-mono text-xs font-bold block mb-1">1. طبقة البيانات (Database)</span>
                    <p className="text-xs text-slate-400">
                      PostgreSQL 14+ مع 7 جداول مترابطة ومحفزات قيود متقدمة وفرادة باركود لكل مسجد، وفهرس جزئي فريد لمنع ازدواجية الإعارة.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-teal-400 font-mono text-xs font-bold block mb-1">2. طبقة الخدمات (Services)</span>
                    <p className="text-xs text-slate-400">
                      خدمات مستقلة (Mosques, Books, Copies, Loans, Users, Ebooks, Sync) تضمن تنفيذ المعاملات الذرية وحل مشكلة تسلسل BigInt.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-cyan-400 font-mono text-xs font-bold block mb-1">3. واجهات API (Next.js)</span>
                    <p className="text-xs text-slate-400">
                      Route Handlers معيارية مع مظروف استجابة موحد (Envelope)، ومعالجة أخطاء القيود تلقائياً وتصفح مرن مع فلاتر ذكية.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">Next.js 16 App Router</span>
                  <span className="px-3 py-1 bg-teal-950 text-teal-400 border border-teal-800 rounded-md">Prisma ORM 6</span>
                  <span className="px-3 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-md">PostgreSQL 18</span>
                  <span className="px-3 py-1 bg-purple-950 text-purple-400 border border-purple-800 rounded-md">TypeScript 5</span>
                  <span className="px-3 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-md">Tailwind CSS 4</span>
                </div>
              </div>

              {/* أحدث الإعارات المسجلة */}
              <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/70 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center justify-between">
                  <span>🔄 أحدث الإعارات المسجلة</span>
                  <button onClick={() => setActiveTab('loans')} className="text-xs text-emerald-400 hover:underline">
                    عرض الكل
                  </button>
                </h3>

                {stats?.recentLoans && stats.recentLoans.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentLoans.map((loan: RecentLoanSummary) => (
                      <div key={loan.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-200">
                          <span className="truncate max-w-[140px]">{loan.book_copies?.books?.title}</span>
                          <span className="text-emerald-400">{loan.mosques?.name}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>المستعير: {loan.users_loans_user_idTousers?.full_name}</span>
                          <span>{new Date(loan.loan_date).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">لا توجد إعارات مسجلة حتى الآن</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* التبويب 2: فهرس الكتب Books */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/70">
              <div className="relative w-full sm:w-96">
                <input
                  type="text"
                  placeholder="ابحث بالعنوان، المؤلف، التصنيف، أو الـ ISBN..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadBooks()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadBooks}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  بحث 🔍
                </button>
              </div>
            </div>

            {/* جدول الكتب */}
            <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-800/50 shadow-lg">
              <table className="w-full text-right text-sm text-slate-300">
                <thead className="bg-slate-900/90 text-xs font-bold text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-4">عنوان الكتاب</th>
                    <th className="p-4">المؤلف</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">الترقيم الدولي (ISBN)</th>
                    <th className="p-4">النسخ الورقية</th>
                    <th className="p-4">الملفات الإلكترونية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {books.length > 0 ? (
                    books.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/70 transition">
                        <td className="p-4 font-semibold text-white">{b.title}</td>
                        <td className="p-4 text-slate-400">{b.author}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-xs bg-slate-700/60 text-emerald-300 border border-slate-600">
                            {b.category || 'عام'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">{b.isbn || 'غير مسجل'}</td>
                        <td className="p-4">
                          <span className="font-bold text-emerald-400">{b._count?.book_copies ?? 0}</span> نسخة
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-cyan-400">{b._count?.ebook_files ?? 0}</span> ملف
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        لا توجد كتب مسجلة حالياً أو لم يتم العثور على نتائج للبحث.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* التبويب 3: النسخ والباركود Copies */}
        {activeTab === 'copies' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/70">
              <input
                type="text"
                placeholder="ابحث بواسطة الباركود..."
                value={copySearch}
                onChange={(e) => setCopySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCopies()}
                className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={loadCopies}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition"
              >
                بحث الباركود 🏷️
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-800/50 shadow-lg">
              <table className="w-full text-right text-sm text-slate-300">
                <thead className="bg-slate-900/90 text-xs font-bold text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-4">الباركود</th>
                    <th className="p-4">الكتاب</th>
                    <th className="p-4">المسجد الحاضن</th>
                    <th className="p-4">موقع الرف</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">سلامة النسخة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {copies.length > 0 ? (
                    copies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/70 transition">
                        <td className="p-4 font-mono font-bold text-cyan-300">{c.barcode}</td>
                        <td className="p-4 font-medium text-white">{c.books?.title}</td>
                        <td className="p-4 text-emerald-400">{c.mosques?.name} ({c.mosques?.city})</td>
                        <td className="p-4 text-slate-400">{c.shelf_location || 'غير محدد'}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              c.status === 'available'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : c.status === 'borrowed'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {c.status === 'available' ? 'متاح للإعارة' : c.status === 'borrowed' ? 'مستعار حالياً' : c.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{c.condition}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        لا توجد نسخ مسجلة حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* التبويب 4: حركة الإعارة والاسترجاع Loans */}
        {activeTab === 'loans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/70">
              <h2 className="text-base font-bold text-white">سجلات الإعارة النشطة وتاريخ الاسترجاع</h2>
              <button
                onClick={loadLoans}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition"
              >
                تحديث السجلات 🔄
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-800/50 shadow-lg">
              <table className="w-full text-right text-sm text-slate-300">
                <thead className="bg-slate-900/90 text-xs font-bold text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-4">الكتاب والباركود</th>
                    <th className="p-4">المستعير</th>
                    <th className="p-4">مسجد النسخة</th>
                    <th className="p-4">تاريخ الإعارة</th>
                    <th className="p-4">تاريخ الاستحقاق</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loans.length > 0 ? (
                    loans.map((l) => {
                      const isOverdue = l.status === 'active' && new Date(l.due_date) < new Date();
                      return (
                        <tr key={l.id} className="hover:bg-slate-800/70 transition">
                          <td className="p-4">
                            <div className="font-semibold text-white">{l.book_copies?.books?.title}</div>
                            <div className="font-mono text-xs text-cyan-400">{l.book_copies?.barcode}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{l.users_loans_user_idTousers?.full_name}</div>
                            <div className="text-xs text-slate-400">عضوية: {l.users_loans_user_idTousers?.membership_number || '-'}</div>
                          </td>
                          <td className="p-4 text-emerald-400">{l.mosques?.name}</td>
                          <td className="p-4 text-xs text-slate-400">{new Date(l.loan_date).toLocaleDateString('ar-SA')}</td>
                          <td className="p-4 text-xs font-semibold text-slate-300">
                            {new Date(l.due_date).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                l.status === 'returned'
                                  ? 'bg-slate-800 text-slate-400'
                                  : isOverdue
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              }`}
                            >
                              {l.status === 'returned' ? 'مسترجع' : isOverdue ? 'متأخر ⚠️' : 'نشط'}
                            </span>
                          </td>
                          <td className="p-4">
                            {l.status === 'active' ? (
                              <button
                                onClick={() => handleReturnLoan(l.id, l.loaned_by || '')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
                              >
                                إرجاع الكتاب ✓
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">تم الإرجاع</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        لا توجد سجلات إعارة حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* التبويب 5: شبكة المساجد Mosques */}
        {activeTab === 'mosques' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/70">
              <div>
                <h2 className="text-base font-bold text-white">المساجد المرتبطة بالنظام الموحد</h2>
                <p className="text-xs text-slate-400">كافة المساجد المفعلة وعدد مقتنياتها وإعاراتها الجارية</p>
              </div>
              <button
                onClick={loadMosques}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition"
              >
                تحديث المساجد 🔄
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {mosques.length > 0 ? (
                mosques.map((m) => (
                  <div key={m.id} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 shadow-md space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-700">
                          {m.code}
                        </span>
                        <h3 className="text-lg font-bold text-white mt-2">{m.name}</h3>
                        <p className="text-xs text-slate-400">{m.city} {m.district ? ` - حي ${m.district}` : ''}</p>
                      </div>
                      <span className="text-2xl">🕌</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50 text-center">
                      <div className="p-2 bg-slate-900/60 rounded-xl">
                        <span className="text-xs text-slate-400 block">النسخ</span>
                        <span className="text-sm font-bold text-emerald-400">{m._count?.book_copies ?? 0}</span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-xl">
                        <span className="text-xs text-slate-400 block">الإعارات</span>
                        <span className="text-sm font-bold text-amber-400">{m._count?.loans ?? 0}</span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-xl">
                        <span className="text-xs text-slate-400 block">المستخدمين</span>
                        <span className="text-sm font-bold text-cyan-400">{m._count?.users ?? 0}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-800">
                  لا توجد مساجد مدخلة بعد. يمكنك إضافتها عبر الـ API أو سكربت التهيئة.
                </div>
              )}
            </div>
          </div>
        )}

        {/* التبويب 6: فاحص ودليل الـ API التفاعلي */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/70 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚡</span>
                فاحص ومستكشف نقاط النهاية (Live Interactive API Explorer)
              </h2>
              <p className="text-xs text-slate-400">
                انقر على أي نقطة نهاية لتنفيذ طلب مباشر ومعاينة استجابة JSON المعيارية مع القيود والبيانات:
              </p>

              {/* أزرار فحص الـ APIs المجهزة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { title: 'إحصائيات المنظومة', method: 'GET', url: '/api/stats', color: 'emerald' },
                  { title: 'فهرس الكتب والعناوين', method: 'GET', url: '/api/books?limit=5', color: 'teal' },
                  { title: 'جرد النسخ والباركود', method: 'GET', url: '/api/copies?limit=5', color: 'cyan' },
                  { title: 'حركة الإعارات النشطة', method: 'GET', url: '/api/loans?limit=5', color: 'amber' },
                  { title: 'تنبيه الإعارات المتأخرة', method: 'GET', url: '/api/loans/overdue', color: 'rose' },
                  { title: 'قائمة شبكة المساجد', method: 'GET', url: '/api/mosques?limit=5', color: 'indigo' },
                  { title: 'المستخدمين والأعضاء', method: 'GET', url: '/api/users?limit=5', color: 'purple' },
                  { title: 'الكتب الإلكترونية', method: 'GET', url: '/api/ebooks?limit=5', color: 'blue' },
                  { title: 'سجل المزامنة دون اتصال', method: 'GET', url: '/api/sync?limit=5', color: 'slate' },
                  { title: 'فحص صحة اتصال PostgreSQL', method: 'GET', url: '/api/db-health', color: 'emerald' },
                  { title: 'فحص جاهزية الخدمة', method: 'GET', url: '/api/health', color: 'slate' },
                ].map((ep, i) => (
                  <button
                    key={i}
                    disabled={apiTesting}
                    onClick={() => testEndpoint(ep.url, ep.method)}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 text-right flex flex-col justify-between transition group hover:shadow-lg"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-bold text-white">{ep.title}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold">
                        {ep.method}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 mt-2 truncate w-full text-left" dir="ltr">
                      {ep.url}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* معاينة استجابة الـ API */}
            {apiTesting && (
              <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse">
                جاري إرسال الطلب واستلام الرد من Next.js Route Handler... ⏳
              </div>
            )}

            {apiResult && !apiTesting && (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-mono text-xs text-emerald-400 font-bold" dir="ltr">
                    {apiResult.endpoint}
                  </span>
                  <span
                    className={`font-mono text-xs px-2.5 py-1 rounded-full font-bold ${
                      apiResult.status >= 200 && apiResult.status < 300
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    Status: {apiResult.status}
                  </span>
                </div>
                <div className="p-6 overflow-x-auto max-h-96 text-left" dir="ltr">
                  <pre className="font-mono text-xs text-slate-300 whitespace-pre">
                    {JSON.stringify(apiResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* التبويب 7: صحة الاتصال والبيئة Health */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/70 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🩺</span>
                تقرير فحص اتصال قاعدة بيانات PostgreSQL والجداول السبعة
              </h2>
              <p className="text-xs text-slate-400">
                التحقق المباشر من استعلامات `prisma.$queryRaw` وقراءة كافة الجداول الأساسية:
              </p>

              {dbHealth ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 block">حالة الاتصال</span>
                      <span
                        className={`text-base font-bold ${
                          dbHealth.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {dbHealth.status}
                      </span>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 block">اسم قاعدة البيانات</span>
                      <span className="text-base font-bold text-white">{dbHealth.database || '-'}</span>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 block">المستخدم الحالي</span>
                      <span className="text-base font-bold text-cyan-400">{dbHealth.currentUser || '-'}</span>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400 block">زمن الاستجابة (Latency)</span>
                      <span className="text-base font-bold text-amber-400">{dbHealth.latencyMs ? `${dbHealth.latencyMs} ms` : '-'}</span>
                    </div>
                  </div>

                  {dbHealth.tablesVerified && (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                      <table className="w-full text-right text-xs text-slate-300">
                        <thead className="bg-slate-950 font-bold text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-3">اسم الجدول</th>
                            <th className="p-3">حالة الوصول (Access)</th>
                            <th className="p-3">عدد السجلات الحالية (Count)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {Object.entries(dbHealth.tablesVerified).map(([table, val]: [string, TableVerification]) => (
                            <tr key={table}>
                              <td className="p-3 font-bold text-white">{table}</td>
                              <td className="p-3 text-emerald-400">{val.status}</td>
                              <td className="p-3 text-cyan-400">{val.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {dbHealth.error && (
                    <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
                      <strong>رسالة الخطأ:</strong> {dbHealth.error}
                      <p className="mt-2 text-slate-400">
                        تأكد من ضبط بيانات `DATABASE_URL` في ملف `.env` وفق الدليل المرفق في `SETUP_FOR_TEAMMATE.md`.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">جاري فحص الاتصال بقاعدة البيانات...</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* الشريط السفلي Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12 text-center text-xs text-slate-500">
        <p>نظام إدارة مكتبات المساجد المترابطة (Interconnected Mosque Libraries System)</p>
        <p className="mt-1">تم بناء وتصميم المعمارية والـ API وفق أفضل الممارسات الموثوقة لـ PostgreSQL و Next.js App Router</p>
      </footer>
    </div>
  );
}
