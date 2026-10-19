# دليل إعداد وتشغيل مشروع إدارة مكتبات المساجد المترابطة
# (Teammate Setup & Deployment Guide)

مرحباً بك! هذا الدليل يوضح خطوات إعداد وتشغيل المشروع على جهازك الجديد من الصفر، مع ضبط قاعدة بيانات PostgreSQL وحساب التشغيل الآمن وتشغيل تطبيق Next.js.

---

## 1. المتطلبات الأساسية (Prerequisites)

تأكد من تثبيت البرمجيات التالية على جهازك:
* **Node.js**: الإصدار 20 LTS أو 22 LTS أو 25 (تم التطوير والاختبار على `v25.9.0`).
* **npm**: الإصدار 10 أو 11 (تم الاختبار على `11.12.1`).
* **PostgreSQL**: الإصدار 14 فأعلى (يُفضل 16 أو 18، تم التطوير على `18.6`).
* **أداة سطر الأوامر `psql`**: تأكد من إضافتها لمسار النظام `PATH` أو معرفة مسارها التنفيذي.

> **ملاحظة حول الامتدادات**: المخطط يستخدم الدالة الأصلية `gen_random_uuid()` المدعومة تلقائياً وبشكل مدمج في PostgreSQL 13 وما فوق دون الحاجة لتثبيت أي امتدادات إضافية مثل `uuid-ossp` أو `pgcrypto`.

---

## 2. إعداد قاعدة بيانات PostgreSQL

### أ. إنشاء قاعدة البيانات
افتح سطر الأوامر (CMD أو PowerShell أو Terminal) ونفّذ أمر إنشاء قاعدة بيانات جديدة باسم `mosque_library`:

```bash
# استبدل postgres باسم المستخدم المسؤول لديك إن كان مختلفاً
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE mosque_library ENCODING 'UTF8';"
```

---

### ب. استعادة مخطط قاعدة البيانات (Restore Schema)
استعد ملف المخطط المرفق `database/schema_dump.sql` إلى قاعدة البيانات الجديدة:

```bash
psql -U postgres -h 127.0.0.1 -d mosque_library -f database/schema_dump.sql
```

> **ملاحظة**: الملف يحتوي على تعريفات الجداول السبعة (`mosques`, `users`, `books`, `book_copies`, `ebook_files`, `loans`, `sync_journal`) وكافة القيود والمفاتيح والفهارس والمحفزات دون أي بيانات تجريبية أو أسرار.

---

### ج. إنشاء حساب تشغيل محلي مخصص (Least Privilege)
وفق أفضل الممارسات الأمنية، **لا تستخدم حساب `postgres` الخارق لتشغيل التطبيق**. أنشئ مستخدماً محلياً مخصصاً للتطبيق (مثلاً: `mosque_app`) بكلمة مرور تختارها:

افتح `psql`:
```bash
psql -U postgres -h 127.0.0.1 -d mosque_library
```

ونفّذ الأوامر التالية:

```sql
-- 1. إنشاء المستخدم (استبدل YOUR_STRONG_PASSWORD بكلمة مرور خاصة بك)
CREATE ROLE mosque_app WITH 
    LOGIN 
    PASSWORD 'YOUR_STRONG_PASSWORD'
    NOSUPERUSER 
    NOCREATEDB 
    NOCREATEROLE 
    NOREPLICATION 
    NOBYPASSRLS;

-- 2. منح صلاحية الاتصال بقاعدة البيانات
GRANT CONNECT ON DATABASE mosque_library TO mosque_app;

-- 3. منح صلاحية استخدام المخطط العام
GRANT USAGE ON SCHEMA public TO mosque_app;

-- 4. منح صلاحيات القراءة والكتابة فقط على الجداول (دون صلاحية TRUNCATE أو DDL)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mosque_app;

-- 5. منح صلاحيات التسلسلات
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mosque_app;
```

---

## 3. إعداد تطبيق Next.js

### أ. إنشاء ملف الإعدادات المحلية `.env`
انسخ ملف القالب `.env.example` إلى ملف جديد باسم `.env`:

```bash
# على ويندوز (PowerShell):
Copy-Item .env.example .env

# على لينكس / ماك:
cp .env.example .env
```

افتح ملف `.env` وقم بتعديل سلسلة الاتصال بالبيانات التي أنشأتها:
```env
DATABASE_URL="postgresql://mosque_app:YOUR_STRONG_PASSWORD@127.0.0.1:5432/mosque_library?schema=public"
PORT=3000
```

> ⚠️ **تنبيه أمني**: ملف `.env` مستثنى تلقائياً من Git عبر `.gitignore`. احرص على عدم رفعه أو مشاركة كلمة المرور.

---

### ب. تثبيت الحزم بدقة (Clean Install)
لتثبيت نفس إصدارات الحزم المطابقة للمشروع الأصلي، نفّذ:

```bash
npm ci
```

---

### ج. توليد عميل Prisma (Generate Prisma Client)
قم بتوليد عميل Prisma استناداً إلى المخطط الموجود في `prisma/schema.prisma`:

```bash
npx prisma generate
```

---

## 4. تشغيل المشروع واختبار الاتصال

### أ. التشغيل في بيئة التطوير
```bash
npm run dev
```
سيعمل التطبيق افتراضياً على: `http://localhost:3000`

---

### ب. اختبار نقاط التحقق (Health Check Endpoints)

افتح المتصفح أو أداة مثل `curl` أو Postman وافحص النقطتين:

1. **فحص جاهزية التطبيق**:
   ```
   GET http://localhost:3000/api/health
   ```
   يجب أن تكون الاستجابة:
   ```json
   {
     "status": "ok",
     "service": "mosque-library-api",
     "framework": "Next.js App Router"
   }
   ```

2. **فحص الاتصال بقاعدة البيانات وقراءة الجداول**:
   ```
   GET http://localhost:3000/api/db-health
   ```
   يجب أن تعود الاستجابة بحالة `connected` وتؤكد الوصول لكافة الجداول السبعة:
   ```json
   {
     "status": "connected",
     "database": "mosque_library",
     "currentUser": "mosque_app",
     "engine": "PostgreSQL",
     "tablesVerified": {
       "mosques": { "status": "accessible", "count": 0 },
       "users": { "status": "accessible", "count": 0 },
       "books": { "status": "accessible", "count": 0 },
       "book_copies": { "status": "accessible", "count": 0 },
       "ebook_files": { "status": "accessible", "count": 0 },
       "loans": { "status": "accessible", "count": 0 },
       "sync_journal": { "status": "accessible", "count": 0 }
     }
   }
   ```

---

## 5. التحقق من تطابق الجداول والقيود الأساسية

للتأكد التام من تطابق بيئتك مع النسخة الأصلية، يمكنك تشغيل سكربت الفحص المرفق في مسار `database/final_audit.sql`:

```bash
psql -U postgres -h 127.0.0.1 -d mosque_library -f database/final_audit.sql
```

النقاط الجوهرية التي يجب أن تتأكد من وجودها:
1. **قيد فرادة الباركود داخل المسجد فقط**: `uq_book_copies_mosque_barcode UNIQUE (mosque_id, barcode)`.
2. **قيد منع تكرار الإعارة لنفس النسخة**: الفهرس الفريد الجزئي `uq_active_loan_per_copy`.
3. **تطابق مسجد الإعارة مع النسخة**: المفتاح الأجنبي المركب `fk_loans_copy_mosque`.
4. **محفز التحقق من صلاحية أمين المكتبة**: `trg_validate_loan_staff` لمنع أي أمين مكتبة من تسجيل إعارة خارج مسجده.
5. **محفزات التحديث الزمني وإصدار المزامنة**: `update_timestamp_and_sync_version()` المربوطة بكافة الجداول.

---

إذا واجهت أي استفسار، تواصل مع فريق العمل!
