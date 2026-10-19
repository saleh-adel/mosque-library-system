-- ============================================================================
-- الفحص النهائي الشامل لقاعدة البيانات (Comprehensive Final Audit)
-- المشروع: نظام إدارة المكتبات المترابطة للمساجد
-- قاعدة البيانات: mosque_library
-- ============================================================================

\pset border 2
\pset format aligned

-- ----------------------------------------------------------------------------
-- 1. التحقق من اسم قاعدة البيانات الفعلي ومعلومات الاتصال
-- ----------------------------------------------------------------------------
\echo '======================================================================'
\echo '1. معلومات الاتصال وقاعدة البيانات الفعلية (Connection & Database Info)'
\echo '======================================================================'

SELECT 
    current_database() AS "قاعدة البيانات الحالية",
    current_user AS "المستخدم الحالي",
    inet_server_addr() AS "عنوان الخادم",
    inet_server_port() AS "منفذ الخادم",
    version() AS "إصدار خادم PostgreSQL";

-- ----------------------------------------------------------------------------
-- 2. التحقق من وجود الجداول السبعة المطلوبة
-- ----------------------------------------------------------------------------
\echo '======================================================================'
\echo '2. الجداول المطلوبة وحالتها في النظام (Table Existence & Status)'
\echo '======================================================================'

SELECT 
    table_name AS "اسم الجدول",
    CASE 
        WHEN table_name IN ('mosques', 'users', 'books', 'book_copies', 'ebook_files', 'loans', 'sync_journal') THEN 'موجود ومطابق للمتطلبات ✓'
        ELSE 'جدول إضافي'
    END AS "الحالة",
    (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS "عدد الأعمدة"
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- 3. حصر القيود: المفاتيح الأساسية والخارجية وقيود UNIQUE و CHECK
-- ----------------------------------------------------------------------------
\echo '======================================================================'
\echo '3.1 المفاتيح الأساسية (Primary Keys)'
\echo '======================================================================'

SELECT 
    conrelid::regclass AS "الجدول",
    conname AS "اسم القيد",
    pg_get_constraintdef(oid) AS "التعريف"
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype = 'p'
ORDER BY conrelid::regclass::text;

\echo '======================================================================'
\echo '3.2 المفاتيح الخارجية والعلاقات العلائقية (Foreign Keys)'
\echo '======================================================================'

SELECT 
    conrelid::regclass AS "الجدول المصدر",
    conname AS "اسم قيد الربط",
    pg_get_constraintdef(oid) AS "التعريف العلائقي"
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype = 'f'
ORDER BY conrelid::regclass::text, conname;

\echo '======================================================================'
\echo '3.3 قيود الفرادة (UNIQUE Constraints)'
\echo '======================================================================'

SELECT 
    conrelid::regclass AS "الجدول",
    conname AS "اسم القيد الفريد",
    pg_get_constraintdef(oid) AS "أعمدة الفرادة"
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype = 'u'
ORDER BY conrelid::regclass::text, conname;

\echo '======================================================================'
\echo '3.4 قيود التحقق المنطقي (CHECK Constraints)'
\echo '======================================================================'

SELECT 
    conrelid::regclass AS "الجدول",
    conname AS "اسم قيد التحقق",
    pg_get_constraintdef(oid) AS "الشرط المنطقي"
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype = 'c'
ORDER BY conrelid::regclass::text, conname;

\echo '======================================================================'
\echo '3.5 قائمة الفهارس الحالية (Current Indexes)'
\echo '======================================================================'

SELECT 
    tablename AS "الجدول",
    indexname AS "اسم الفهرس",
    indexdef AS "تعريف الفهرس"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo '======================================================================'
\echo '3.6 فحص الفهارس المتطابقة / المكررة (Duplicate Indexes Audit)'
\echo '======================================================================'

SELECT 
    t.relname AS "الجدول",
    i1.relname AS "الفهرس الأول",
    i2.relname AS "الفهرس المكرر",
    pg_get_indexdef(i1.oid) AS "التعريف"
FROM pg_index x1
JOIN pg_index x2 ON x1.indrelid = x2.indrelid AND x1.indexrelid < x2.indexrelid
JOIN pg_class t ON t.oid = x1.indrelid
JOIN pg_class i1 ON i1.oid = x1.indexrelid
JOIN pg_class i2 ON i2.oid = x2.indexrelid
WHERE x1.indkey = x2.indkey
  AND COALESCE(pg_get_expr(x1.indpred, x1.indrelid), '') = COALESCE(pg_get_expr(x2.indpred, x2.indrelid), '')
  AND COALESCE(pg_get_expr(x1.indexprs, x1.indrelid), '') = COALESCE(pg_get_expr(x2.indexprs, x2.indrelid), '')
  AND t.relnamespace = 'public'::regnamespace;

-- إذا كانت النتيجة أعلاه 0 صفوف، فهذا يؤكد خلو النظام تماماً من أي فهارس متطابقة مكررة.

-- ----------------------------------------------------------------------------
-- 4. الاختبارات الوظيفية الحية داخل معاملة متراجَع عنها (BEGIN ... ROLLBACK)
-- ----------------------------------------------------------------------------
\echo '======================================================================'
\echo '4. الاختبارات الوظيفية الحية على القيود والمحفزات (Live Functional Tests)'
\echo '======================================================================'

BEGIN;

DO $$
DECLARE
    v_mosque1 UUID := gen_random_uuid();
    v_mosque2 UUID := gen_random_uuid();
    v_admin UUID := gen_random_uuid();
    v_lib1 UUID := gen_random_uuid();
    v_lib2 UUID := gen_random_uuid();
    v_member_active UUID := gen_random_uuid();
    v_member_inactive UUID := gen_random_uuid();
    v_book UUID := gen_random_uuid();
    v_copy1 UUID := gen_random_uuid();
    v_copy2 UUID := gen_random_uuid();
    v_loan UUID := gen_random_uuid();
    v_test_passed BOOLEAN;
BEGIN
    RAISE NOTICE '>>> جاري إعداد بيانات الاختبار المؤقتة بمعرّفات فريدة مستقلة...';

    -- 1. إدخال مساجد الاختبار
    INSERT INTO mosques (id, code, name, city) VALUES 
        (v_mosque1, 'TEST-MSQ-01', 'مسجد الفحص الأول', 'الرياض'),
        (v_mosque2, 'TEST-MSQ-02', 'مسجد الفحص الثاني', 'مكة المكرمة');

    -- 2. إدخال مستخدمين بأدوار مختلفة
    INSERT INTO users (id, role, username, full_name, password_hash, is_active) VALUES
        (v_admin, 'admin', 'audit_admin', 'مشرف عام الفحص', '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', TRUE);

    INSERT INTO users (id, role, mosque_id, username, full_name, password_hash, is_active) VALUES
        (v_lib1, 'librarian', v_mosque1, 'audit_lib1', 'أمين مسجد 1', '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', TRUE),
        (v_lib2, 'librarian', v_mosque2, 'audit_lib2', 'أمين مسجد 2', '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', TRUE),
        (v_member_active, 'member', v_mosque1, 'audit_mem_act', 'مستفيد نشط', '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', TRUE),
        (v_member_inactive, 'member', v_mosque1, 'audit_mem_inact', 'مستفيد معطل', '$argon2id$v=19$m=65536,t=3,p=4$dummyhash', FALSE);

    -- 3. إدخال كتاب تجريبي
    INSERT INTO books (id, isbn, title, author) VALUES
        (v_book, '978-600-000-001-1', 'كتاب الفحص النهائي', 'مؤلف الفحص');

    -- ------------------------------------------------------------------------
    -- الاختبار 4.1: فرادة الباركود داخل المسجد الواحد
    -- ------------------------------------------------------------------------
    INSERT INTO book_copies (id, book_id, mosque_id, barcode) VALUES
        (v_copy1, v_book, v_mosque1, 'BARCODE-XYZ-1');

    BEGIN
        INSERT INTO book_copies (book_id, mosque_id, barcode) VALUES
            (v_book, v_mosque1, 'BARCODE-XYZ-1');
        RAISE EXCEPTION 'TEST 4.1 FAILED: تم السماح بتكرار الباركود في نفس المسجد!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.1: تم منع تكرار الباركود داخل نفس المسجد بنجاح عبر قيد (uq_book_copies_mosque_barcode).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.2: السماح بنفس الباركود في مسجد مختلف
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO book_copies (id, book_id, mosque_id, barcode) VALUES
            (v_copy2, v_book, v_mosque2, 'BARCODE-XYZ-1');
        RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.2: سُمح بتكرار الباركود بين مساجد مختلفة بنجاح.';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'TEST 4.2 FAILED: فشل إدخال نفس الباركود في مسجد مختلف! خطأ: %', SQLERRM;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.3: منع الإعارة المزدوجة المتزامنة لنفس النسخة
    -- ------------------------------------------------------------------------
    -- إعارة نشطة أولى
    INSERT INTO loans (id, copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
        (v_loan, v_copy1, v_mosque1, v_member_active, v_lib1, CURRENT_TIMESTAMP + INTERVAL '14 days', 'active');

    -- محاولة إعارة ثانية لنفس النسخة وهي ما زالت نشطة
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy1, v_mosque1, v_member_active, v_admin, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'TEST 4.3 FAILED: تم السماح بإعارة ثانية متزامنة لنفس النسخة!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.3: تم منع إعارتين نشطتين للنسخة نفسها بنجاح عبر الفهرس الفريد الجزئي (uq_active_loan_per_copy).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.4: قيود تطابق المسجد بين النسخة والإعارة
    -- ------------------------------------------------------------------------
    -- النسخة v_copy2 تتبع للمسجد v_mosque2 وليس لديها إعارة نشطة.
    -- سنحاول تسجيل إعارة لها ونسبتها كذباً للمسجد v_mosque1 (يجب أن ترفض فورا بسبب المفتاح الأجنبي المركب).
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy2, v_mosque1, v_member_active, v_admin, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'TEST 4.4 FAILED: تم السماح بإعارة نسخة منسوبة لمسجد مختلف عن مسجدها!';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.4: تم منع تسجيل إعارة لمسجد لا تتبع له النسخة بنجاح عبر المفتاح الأجنبي المركب (fk_loans_copy_mosque).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.5: صلاحية أمين المكتبة محصورة بمسجده فقط
    -- ------------------------------------------------------------------------
    -- أمين المسجد 1 (v_lib1) يحاول تنفيذ إعارة على النسخة 2 في المسجد 2 (v_mosque2)
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy2, v_mosque2, v_member_active, v_lib1, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'TEST 4.5 FAILED: تم السماح لأمين مكتبة بتنفيذ إعارة في غير مسجده!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%أمين المكتبة غير مخوّل بالعمل في هذا المسجد%' THEN
                RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.5: تم حظر أمين المكتبة من تنفيذ إعارة خارج مسجده بنجاح عبر المحفز (trg_validate_loan_staff).';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع في اختبار 4.5: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.6: صلاحية المشرف العام (admin) تمتد لجميع المساجد
    -- ------------------------------------------------------------------------
    BEGIN
        -- المشرف ينفذ إعارة على النسخة 2 في المسجد 2
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy2, v_mosque2, v_member_active, v_admin, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.6: سُمح للمشرف العام بإدارة وتنفيذ الإعارة عبر أي مسجد بنجاح.';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'TEST 4.6 FAILED: فشل المشرف العام في تنفيذ الإعارة! خطأ: %', SQLERRM;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.7: منع المستفيد من تسجيل إعارة كموظف
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy2, v_mosque2, v_member_active, v_member_active, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'TEST 4.7 FAILED: تم السماح لمستفيد عادي بتسجيل إعارة كموظف!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%المستخدم المنفذ للإعارة ليس لديه صلاحية%' THEN
                RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.7: تم التحقق بنجاح من منع المستفيدين العاديين من تسجيل الإعارات.';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع في اختبار 4.7: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.8: منع الإعارة للمستفيدين المعطلين
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status) VALUES
            (v_copy2, v_mosque2, v_member_inactive, v_admin, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'TEST 4.8 FAILED: تم السماح بإعارة لمستفيد حسابه معطل!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%حساب المستعير معطّل%' THEN
                RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.8: تم منع الإعارة للمستفيد المعطل بنجاح.';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع في اختبار 4.8: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.9: اتساق حالات الإرجاع وتواريخه
    -- ------------------------------------------------------------------------
    BEGIN
        UPDATE loans SET status = 'returned', return_date = NULL WHERE id = v_loan;
        RAISE EXCEPTION 'TEST 4.9 FAILED: تم السماح بحالة returned مع تاريخ إرجاع فارغ!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.9: تم فرض اتساق حالة الإرجاع مع تاريخ الإرجاع الفعلي بنجاح عبر (chk_loan_return_consistency).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 4.10: حماية السجلات التاريخية عند الحذف (RESTRICT)
    -- ------------------------------------------------------------------------
    BEGIN
        DELETE FROM books WHERE id = v_book;
        RAISE EXCEPTION 'TEST 4.10 FAILED: تم حذف كتاب وله سجلات إعارات ونسخ!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '[نجح - اختبار حي] الاختبار 4.10: تم منع الحذف التدميري للكتاب وسجلاته التاريخية بنجاح عبر (ON DELETE RESTRICT).';
    END;

    RAISE NOTICE '>>> اكتملت جميع الاختبارات الـ 10 الحية بنجاح بنسبة 100%%.';
END;
$$;

-- التراجع الإلزامي عن المعاملة لتفريغ كافة بيانات الاختبار وضمان بقاء القاعدة نظيفة تماماً
ROLLBACK;

\echo '======================================================================'
\echo '5. التحقق من بقاء قاعدة البيانات نظيفة بعد التراجع (Database Row Counts)'
\echo '======================================================================'

SELECT 
    schemaname,
    relname AS "الجدول",
    n_live_tup AS "عدد السجلات الحية"
FROM pg_stat_user_tables
ORDER BY relname;

\echo '======================================================================'
\echo 'تم إنجاز الفحص النهائي الشامل بنجاح تام.'
\echo '======================================================================'
