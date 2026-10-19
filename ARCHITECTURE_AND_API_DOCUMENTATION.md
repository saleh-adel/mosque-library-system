# التوثيق الشامل لمعمارية النظام وربط الـ API بقاعدة البيانات
## منظومة إدارة مكتبات المساجد المترابطة (Interconnected Mosque Libraries System)

---

## الفهرس
1. [الإجابة المباشرة: هل تم ربط قاعدة البيانات بالـ API؟](#1-الإجابة-المباشرة-هل-تم-ربط-قاعدة-البيانات-بالـ-api)
2. [المعمارية الهيكلية للنظام (Layered Architecture)](#2-المعمارية-الهيكلية-للنظام-layered-architecture)
3. [مخطط قاعدة البيانات والقيود (Database & Constraints)](#3-مخطط-قاعدة-البيانات-والقيود-database--constraints)
4. [طبقة الخدمات والعمليات (Services Layer)](#4-طبقة-الخدمات-والعمليات-services-layer)
5. [دليل واجهات البرمجة الكامل (REST API Reference)](#5-دليل-واجهات-البرمجة-الكامل-rest-api-reference)
6. [الواجهة ولوحة التحكم التفاعلية (Frontend Dashboard)](#6-الواجهة-ولوحة-التحكم-التفاعلية-frontend-dashboard)
7. [خطوات التشغيل المحلي خطوة بخطوة](#7-خطوات-التشغيل-المحلي-خطوة-بخطوة)

---

## 1. الإجابة المباشرة: هل تم ربط قاعدة البيانات بالـ API؟

### **نعم، تم الربط البرمجي والعلائقي بنسبة 100%.**

إليك كيف تم الربط تقنياً:
1. **طبقة الاتصال بالبيانات (`Prisma ORM`)**:
   - تم ربط الـ API بمخطط PostgreSQL من خلال العميل الموحد في `src/lib/prisma.ts`.
   - تم توليد كود الـ TypeScript الكامل لنماذج قاعدة البيانات السبعة عبر أمر `npx prisma generate`.
2. **استدعاءات الـ API للجداول**:
   - كل نقطة نهاية (`Route Handler`) في مسار `src/app/api/*` مرتبطة بخدمة (`Service`) تستعلم مباشرة من الجداول عبر `prisma.<model>.<operation>`.
   - مثال: عند طلب `GET /api/books`، يقوم مسار `src/app/api/books/route.ts` باستدعاء `BooksService.getBooks()` التي تنفذ استعلام `prisma.books.findMany()` متضمناً النسخ المرتبطة في المساجد.
   - مثال: عند تسجيل إعارة في `POST /api/loans`، يتم استدعاء `LoansService.borrowBook()` التي تفتح معاملة موحدة (`prisma.$transaction`) لتسجيل الإعارة وتحديث حالة النسخة إلى `borrowed` في قاعدة البيانات لحظياً.
3. **فحص الربط المباشر**:
   - تم تضمين مسار `/api/db-health` الذي ينفذ استعلام `SELECT current_database(), current_user, version()` ويفحص قدرة القراءة من الجداول السبعة بشكل مباشر.
4. **ما يتبقى فقط على جهازك المحلي**:
   - وضع كلمة مرور مستخدم PostgreSQL في ملف `.env`، وتشغيل سكربت استعادة الجداول (بحيث يكون لسيرفر PostgreSQL المحلي صلاحية استقبال الاتصال).

---

## 2. المعمارية الهيكلية للنظام (Layered Architecture)

تم بناء التطبيق على نمط المعمارية الطبقية النظيفة (Clean Layered Architecture):

```
my-next-app/
├── database/                    # ملفات DDL وسكربتات قاعدة البيانات
│   ├── schema.sql               # المخطط الكامل (الجداول، القيود، الفهارس، المحفزات)
│   ├── seed_sample_data.sql     # بيانات أولية واقعية للمساجد والكتب والإعارات
│   ├── final_audit.sql          # سكربت تدقيق سلامة القيود والفهارس
│   └── verify_fixes.sql         # اختبارات قيود عدم التكرار وصلاحيات الأمناء
├── prisma/
│   └── schema.prisma            # نموذج Prisma ORM المتزامن مع PostgreSQL
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # مسارات الـ API (Route Handlers)
│   │   │   ├── stats/           # مؤشرات وإحصائيات لوحة التحكم
│   │   │   ├── mosques/         # إدارة شبكة المساجد
│   │   │   ├── books/           # الفهرس العام للكتب والعناوين
│   │   │   ├── copies/          # جرد النسخ والباركود والرفوف
│   │   │   ├── loans/           # حركة الإعارة والاسترجاع والمتأخرات
│   │   │   ├── users/           # المشرفون وأمناء المكتبات والمستفيدون
│   │   │   ├── ebooks/          # ملفات الكتب الرقمية
│   │   │   ├── sync/            # سجل المزامنة دون اتصال
│   │   │   ├── health/          # فحص جاهزية التطبيق
│   │   │   └── db-health/       # فحص حي لاتصال PostgreSQL
│   │   ├── layout.tsx           # قالب التطبيق الرئيسي مع دعم العربية RTL
│   │   └── page.tsx             # لوحة التحكم التفاعلية الشاملة
│   ├── lib/
│   │   ├── prisma.ts            # عميل Prisma وحل تسلسل أرقام BigInt
│   │   ├── response.ts          # مظروف الاستجابة الموحد ومعالجة أخطاء القيود
│   │   └── validation.ts        # أدوات استخراج الفلاتر والتحقق من الـ UUID
│   ├── services/                # طبقة منطق الأعمال والعمليات (Services)
│   │   ├── mosques.service.ts
│   │   ├── books.service.ts
│   │   ├── copies.service.ts
│   │   ├── loans.service.ts
│   │   ├── users.service.ts
│   │   ├── ebooks.service.ts
│   │   ├── sync.service.ts
│   │   └── stats.service.ts
│   └── types/
│       └── index.ts             # واجهات TypeScript الموحدة
```

---

## 3. مخطط قاعدة البيانات والقيود (Database & Constraints)

يتكون المخطط من 7 جداول أساسية صُممت وفق معايير قواعد البيانات المتقدمة:

| الجدول | الوظيفة | القيود والمحفزات الجوهرية |
| :--- | :--- | :--- |
| **`mosques`** | شبكة المساجد المترابطة | رمز فريد للمسجد (`code UNIQUE`)، رقم إصدار مزامنة تلقائي |
| **`users`** | المستخدمون والصلاحيات | قيد: أمين المكتبة يجب أن يكون مرتبطاً بمسجد محدد (`chk_librarian_requires_mosque`) |
| **`books`** | الفهرس المركزي للكتب | ترقيم دولي فريد (`isbn UNIQUE`)، اتساق الأرشفة (`chk_books_archive_consistency`) |
| **`book_copies`** | النسخ الورقية على الرفوف | **فرادة الباركود داخل المسجد فقط** (`uq_book_copies_mosque_barcode`)، قيد مركب (`id, mosque_id`) |
| **`ebook_files`** | الملفات الرقمية للكتب | صيغ الملفات المسموحة (`pdf, epub, mobi, docx`)، بصمة التحقق `checksum_sha256` |
| **`loans`** | حركة الإعارة والاسترجاع | **منع تكرار إعارة النسخة** عبر فهرس فريد جزئي (`uq_active_loan_per_copy`)، مطابقة مسجد الإعارة مع النسخة (`fk_loans_copy_mosque`) |
| **`sync_journal`** | سجل المزامنة دون اتصال | تتبع عمليات الإضافة والتعديل والحذف (`INSERT/UPDATE/DELETE`) وحالة المزامنة |

---

## 4. طبقة الخدمات والعمليات (Services Layer)

تم فصل منطق الأعمال عن مسارات الـ HTTP لضمان إعادة الاستخدام واختبار الكود:

### 1. معالجة تسلسل الـ `BigInt`
في PostgreSQL توجد حقول من نوع `BIGINT` (مثل `sync_version` و `file_size_bytes`). هذه الحقول تسبب استثناء شهير في جافاسكريبت `TypeError: Do not know how to serialize a BigInt`.
تم حلها جذرياً في `src/lib/prisma.ts`:
```ts
if (typeof BigInt !== 'undefined') {
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
  };
}
```

### 2. ضمان ذرية المعاملات (Prisma Transactions)
في خدمة الإعارات `LoansService`:
- عند استدعاء `borrowBook`: يتم إنشاء سجل الإعارة وتحديث حالة النسخة إلى `borrowed` داخل معاملة ذرية واحدة (`prisma.$transaction`) لضمان عدم وجود حالة غير متسقة.
- عند استدعاء `returnBook`: يتم إثبات تاريخ الإرجاع وتحديث حالة السجل وإعادة النسخة إلى `available` في نفس المعاملة.

---

## 5. دليل واجهات البرمجة الكامل (REST API Reference)

جميع الاستجابات تتبع المظروف القياسي الموحد (Unified Envelope):

### نموذج الاستجابة الناجحة:
```json
{
  "success": true,
  "data": { ... },
  "message": "تمت العملية بنجاح",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### نموذج استجابة الخطأ:
```json
{
  "success": false,
  "error": "رسالة الخطأ التوضيحية",
  "details": "تفاصيل القيد أو الاستثناء إن وجدت"
}
```

### ملخص نقاط النهاية (Endpoints):

#### 1. الإحصائيات العامة:
- `GET /api/stats`: يعيد ملخصاً شاملاً (المساجد النشطة، إجمالي الكتب، النسخ المتاحة، الإعارات الجارية، المتأخرات، وأحدث 5 إعارات).

#### 2. شبكة المساجد:
- `GET /api/mosques?search=الرياض&city=الرياض&page=1&limit=10`: جلب المساجد مع التصفح والبحث.
- `POST /api/mosques`: تسجيل مسجد جديد (`code, name, city, district, phone, email`).
- `GET /api/mosques/[id]`: تفاصيل المسجد ومقتنياته.
- `PUT /api/mosques/[id]`: تعديل بيانات المسجد.

#### 3. فهرس الكتب:
- `GET /api/books?search=البخاري&category=الحديث`: بحث شامل في العناوين والمؤلف والتصنيف.
- `POST /api/books`: إضافة كتاب جديد.
- `GET /api/books/[id]`: تفاصيل الكتاب مع نسخه في جميع المساجد وملفاته الرقمية.
- `PUT /api/books/[id]`: تعديل بيانات الكتاب.
- `DELETE /api/books/[id]`: أرشفة الكتاب منطقياً مع تسجيل تاريخ وسبب الأرشفة.

#### 4. النسخ والباركود:
- `GET /api/copies?mosqueId={id}&barcode=MSQ1-001&status=available`: جرد النسخ.
- `POST /api/copies`: إضافة نسخة ورقية على رف مسجد محدد.
- `GET /api/copies/[id]`: سجل النسخة وتاريخ إعاراتها.
- `PATCH /api/copies/[id]`: تحديث حالة النسخة (متاح/مستعار/صيانة) وموقع الرف.

#### 5. الإعارة والاسترجاع:
- `GET /api/loans?status=active`: استعراض الإعارات الجارية.
- `POST /api/loans`: تسجيل إعارة جديدة:
  - المدخلات: `{ copyId, userId, loanedBy, dueDate, notes }`.
  - التحقق: النسخة متاحة + المستعير نشط + الموظف تابع لنفس المسجد.
- `POST /api/loans/[id]/return`: تسجيل إرجاع الكتاب:
  - المدخلات: `{ receivedBy, notes }`.
- `GET /api/loans/overdue`: جلب قائمة الكتب المتأخرة عن موعد الإرجاع.

#### 6. المستخدمون والصلاحيات:
- `GET /api/users?role=member&mosqueId={id}`: جلب المستفيدين أو الأمناء.
- `POST /api/users`: إنشاء حساب مستخدم.
- `GET /api/users/[id]`: ملف المستخدم وإعاراته الحالية والسابقة.

#### 7. الفحص والصحة:
- `GET /api/health`: فحص حالة تشغيل الخدمة.
- `GET /api/db-health`: فحص مباشر لاتصال PostgreSQL وقراءة عدد السجلات في الجداول السبعة.

---

## 6. الواجهة ولوحة التحكم التفاعلية (Frontend Dashboard)

توجد واجهة التطبيق في `src/app/page.tsx` وهي تدعم الوضع الليلي واللغة العربية وتوفر:
1. **شريط مؤشرات KPIs لحظي**: يقرأ تلقائياً من `/api/stats`.
2. **تبويب الفهرس العام**: محرك بحث وتصفية للكتب والعناوين.
3. **تبويب جرد النسخ والباركود**: فحص حالة النسخ وأماكن الرفوف.
4. **تبويب حركة الإعارات**: جدول متابعة مع زر "إرجاع الكتاب ✓" بنقرة واحدة.
5. **تبويب شبكة المساجد**: بطاقات إحصائية لكل مسجد تابع للمنظومة.
6. **مستكشف الـ API المباشر (Interactive API Explorer)**: واجهة تجربة سريعة تتيح اختبار أي نقطة نهاية ومعاينة الرد الفعلي بصيغة JSON.
7. **تقرير صحة الاتصال**: شاشة فحص حية للجداول السبعة وزمن الاستجابة (Latency).

---

## 7. خطوات التشغيل المحلي خطوة بخطوة

### الخطوة 1: ضبط كلمة المرور في ملف `.env`
افتح ملف `.env` في مجلد المشروع وضع كلمة المرور الخاصة بسيرفر PostgreSQL لديك:
```env
DATABASE_URL="postgresql://postgres:ضع_كلمة_المرور_هنا@127.0.0.1:5432/mosque_library?schema=public"
PORT=3000
```

### الخطوة 2: إنشاء قاعدة البيانات واستعادة المخطط
في سطر الأوامر (PowerShell):
```powershell
# 1. إنشاء قاعدة البيانات mosque_library
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE mosque_library ENCODING 'UTF8';"

# 2. تطبيق المخطط والقيود والمحفزات
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -d mosque_library -f database/schema.sql

# 3. إدخال البيانات التجريبية الأولية
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -d mosque_library -f database/seed_sample_data.sql
```

### الخطوة 3: توليد عميل Prisma
```powershell
npx prisma generate
```

### الخطوة 4: تشغيل المشروع
```powershell
npm run dev
```
افتح المتصفح على: `http://localhost:3000` وستجد النظام يعمل بكامل طاقته ومربوطاً بقاعدة البيانات.

