# منظومة إدارة مكتبات المساجد المترابطة (Interconnected Mosque Libraries System)

منظومة إلكترونية موحدة لإدارة الفهارس، النسخ الورقية، والإعارات عبر شبكة المساجد المترابطة، مبنية باستخدام **Next.js 16 (App Router)** و **Prisma ORM** و **PostgreSQL 14+**.

---

## 📚 وثائق المشروع ودليل التشغيل
- 📄 **[دليل الشرح الكامل والتفصيلي (EXPLANATION.md)](./EXPLANATION.md)**
- 📖 **[التوثيق الفني المعماري ونقاط الـ API (ARCHITECTURE_AND_API_DOCUMENTATION.md)](./ARCHITECTURE_AND_API_DOCUMENTATION.md)**
- 🛠️ **[دليل إعداد الزميل ونشر البيئة (SETUP_FOR_TEAMMATE.md)](./SETUP_FOR_TEAMMATE.md)**

---

## ⚡ نظرة سريعة على نقاط النهاية (RESTful APIs)

| المسار | الطريقة | الوصف |
| :--- | :--- | :--- |
| `/api/stats` | `GET` | إحصائيات عامة ومؤشرات أداء الشبكة |
| `/api/mosques` | `GET, POST` | إدارة شبكة المساجد المشتركة |
| `/api/books` | `GET, POST` | البحث في الفهرس العام وإضافة الكتب |
| `/api/books/[id]` | `GET, PUT, DELETE` | تفاصيل الكتاب، التعديل، والأرشفة |
| `/api/copies` | `GET, POST` | جرد النسخ بالمسجد والباركود وموقع الرف |
| `/api/copies/[id]` | `GET, PATCH` | تفاصيل النسخة وتحديث حالتها |
| `/api/loans` | `GET, POST` | حركة الإعارة وتسجيل إعارة جديدة |
| `/api/loans/[id]/return` | `POST` | تسجيل إرجاع الكتاب واستلامه وإعادته لحالة متاح |
| `/api/loans/overdue` | `GET` | قائمة الإعارات المتأخرة |
| `/api/users` | `GET, POST` | إدارة المشرفين، أمناء المكتبات، والمستفيدين |
| `/api/ebooks` | `GET, POST` | فهرسة الكتب والملفات الرقمية |
| `/api/sync` | `GET, POST` | سجل مزامنة المحطات الطرفية دون اتصال |
| `/api/db-health` | `GET` | فحص حي ومباشر لاتصال PostgreSQL والجداول السبعة |
| `/api/health` | `GET` | فحص جاهزية التطبيق |

---

## 🚀 البدء السريع (Quick Start)

### 1. إعداد ملف الاتصال `.env`
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/mosque_library?schema=public"
PORT=3000
```

### 2. تجهيز قاعدة البيانات
```powershell
# إنشاء قاعدة البيانات
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE mosque_library ENCODING 'UTF8';"

# استعادة المخطط والقيود
psql -U postgres -h 127.0.0.1 -d mosque_library -f database/schema.sql

# إدخال البيانات التجريبية
psql -U postgres -h 127.0.0.1 -d mosque_library -f database/seed_sample_data.sql
```

### 3. تشغيل الخادم
```powershell
npm run dev
```
افتح المتصفح على: `http://localhost:3000`
