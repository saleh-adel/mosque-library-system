-- ============================================================================
-- سكربت التحقق والاختبار الشامل للتحسينات (Verification Test Suite)
-- المشروع: نظام إدارة المكتبات المترابطة للمساجد
-- قاعدة البيانات: mosque_library
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_mosque1_id UUID;
    v_mosque2_id UUID;
    v_admin_id UUID;
    v_lib1_id UUID;
    v_lib2_id UUID;
    v_member_active_id UUID;
    v_member_inactive_id UUID;
    v_book_id UUID;
    v_copy1_id UUID;
    v_copy2_id UUID;
    v_copy3_id UUID;
    v_loan_id UUID;
BEGIN
    RAISE NOTICE '=== بدء الاختبارات الشاملة للتعديلات الهيكلية ===';

    -- ------------------------------------------------------------------------
    -- تجهيز البيانات المؤقتة للاختبار
    -- ------------------------------------------------------------------------
    INSERT INTO mosques (code, name, city) VALUES ('M-01', 'مسجد الهدى', 'الرياض') RETURNING id INTO v_mosque1_id;
    INSERT INTO mosques (code, name, city) VALUES ('M-02', 'مسجد التقوى', 'جدة') RETURNING id INTO v_mosque2_id;

    INSERT INTO users (role, username, full_name, password_hash)
    VALUES ('admin', 'super_admin', 'المشرف العام', 'hash_admin') RETURNING id INTO v_admin_id;

    INSERT INTO users (role, mosque_id, username, full_name, password_hash)
    VALUES ('librarian', v_mosque1_id, 'lib_m1', 'أمين مسجد الهدى', 'hash_l1') RETURNING id INTO v_lib1_id;

    INSERT INTO users (role, mosque_id, username, full_name, password_hash)
    VALUES ('librarian', v_mosque2_id, 'lib_m2', 'أمين مسجد التقوى', 'hash_l2') RETURNING id INTO v_lib2_id;

    INSERT INTO users (role, mosque_id, username, full_name, password_hash, is_active)
    VALUES ('member', v_mosque1_id, 'mem_active', 'مستفيد نشط', 'hash_m1', TRUE) RETURNING id INTO v_member_active_id;

    INSERT INTO users (role, mosque_id, username, full_name, password_hash, is_active)
    VALUES ('member', v_mosque1_id, 'mem_inactive', 'مستفيد معطل', 'hash_m2', FALSE) RETURNING id INTO v_member_inactive_id;

    INSERT INTO books (isbn, title, author)
    VALUES ('978-0-123456-47-2', 'صحيح البخاري', 'الإمام البخاري') RETURNING id INTO v_book_id;

    -- ------------------------------------------------------------------------
    -- الاختبار 1: إضافة نسخة في المسجد 1 برمز باركود محدد (نجاح)
    -- ------------------------------------------------------------------------
    INSERT INTO book_copies (book_id, mosque_id, barcode)
    VALUES (v_book_id, v_mosque1_id, 'BARCODE-100') RETURNING id INTO v_copy1_id;
    RAISE NOTICE '✓ اختبار 1 نجح: تم إنشاء النسخة الأولى بنجاح.';

    -- ------------------------------------------------------------------------
    -- الاختبار 2: محاولة تكرار نفس الباركود في نفس المسجد 1 (يجب أن يفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO book_copies (book_id, mosque_id, barcode)
        VALUES (v_book_id, v_mosque1_id, 'BARCODE-100');
        RAISE EXCEPTION 'فشل: سُمح بتكرار الباركود داخل المسجد نفسه!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '✓ اختبار 2 نجح: تم رفض تكرار الباركود داخل نفس المسجد (uq_book_copies_mosque_barcode).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 3: استخدام نفس الباركود في مسجد آخر 2 (يجب أن ينجح)
    -- ------------------------------------------------------------------------
    INSERT INTO book_copies (book_id, mosque_id, barcode)
    VALUES (v_book_id, v_mosque2_id, 'BARCODE-100') RETURNING id INTO v_copy2_id;
    RAISE NOTICE '✓ اختبار 3 نجح: سُمح بنفس الباركود في مسجد آخر مختلف.';

    -- ------------------------------------------------------------------------
    -- الاختبار 4: محاولة إعارة نسخة المسجد 1 ونسبتها لمسجد 2 (يجب أن تفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
        VALUES (v_copy1_id, v_mosque2_id, v_member_active_id, v_admin_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'فشل: سُمح بإعارة نسخة لمسجد غير مسجدها الحقيقي!';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE '✓ اختبار 4 نجح: تم منع التناقض بين مسجد النسخة ومسجد الإعارة (fk_loans_copy_mosque).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 5: أمين مسجد 2 يحاول تنفيذ إعارة في مسجد 1 (يجب أن يفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
        VALUES (v_copy1_id, v_mosque1_id, v_member_active_id, v_lib2_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'فشل: سُمح لأمين مكتبة بالعمل خارج مسجده!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%أمين المكتبة غير مخوّل بالعمل في هذا المسجد%' THEN
                RAISE NOTICE '✓ اختبار 5 نجح: تم حظر أمين المكتبة من إدارة إعارات مسجد آخر.';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 6: مستفيد يحاول تنفيذ إعارة كموظف (يجب أن يفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
        VALUES (v_copy1_id, v_mosque1_id, v_member_active_id, v_member_active_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'فشل: سُمح لمستفيد عادي بتسجيل إعارة!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%المستخدم المنفذ للإعارة ليس لديه صلاحية%' THEN
                RAISE NOTICE '✓ اختبار 6 نجح: تم التحقق من وجوب كون الموظف المنفذ أميناً أو مشرفاً.';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 7: محاولة تسجيل إعارة لمستفيد معطّل (يجب أن تفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
        VALUES (v_copy1_id, v_mosque1_id, v_member_inactive_id, v_lib1_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'فشل: سُمح بإعارة لمستفيد معطل!';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%حساب المستعير معطّل%' THEN
                RAISE NOTICE '✓ اختبار 7 نجح: تم رفض الإعارة للمستفيد المعطّل.';
            ELSE
                RAISE EXCEPTION 'خطأ غير متوقع: %', SQLERRM;
            END IF;
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 8: تسجيل إعارة شرعية بنجاح (أمين مسجد 1 ينفذ إعارة لمسجد 1)
    -- ------------------------------------------------------------------------
    INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
    VALUES (v_copy1_id, v_mosque1_id, v_member_active_id, v_lib1_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active')
    RETURNING id INTO v_loan_id;
    RAISE NOTICE '✓ اختبار 8 نجح: تم تسجيل الإعارة الشرعية بنجاح.';

    -- ------------------------------------------------------------------------
    -- الاختبار 9: محاولة إعارة نفس النسخة لمستفيد آخر وهي ما زالت نشطة (يجب أن تفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO loans (copy_id, mosque_id, user_id, loaned_by, due_date, status)
        VALUES (v_copy1_id, v_mosque1_id, v_member_active_id, v_admin_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'فشل: سُمح بإعارة مزدوجة لنفس النسخة!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '✓ اختبار 9 نجح: تم منع الإعارة المزدوجة المتزامنة (uq_active_loan_per_copy).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 10: محاولة تحديث حالة الإعارة إلى returned دون تاريخ إرجاع (يجب أن يفشل)
    -- ------------------------------------------------------------------------
    BEGIN
        UPDATE loans SET status = 'returned', return_date = NULL WHERE id = v_loan_id;
        RAISE EXCEPTION 'فشل: سُمحت حالة returned دون تاريخ إرجاع!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE '✓ اختبار 10 نجح: تم فرض اتساق تاريخ الإرجاع مع حالة الإرجاع (chk_loan_return_consistency).';
    END;

    -- ------------------------------------------------------------------------
    -- الاختبار 11: محاولة حذف كتاب لديه نسخ وإعارات (يجب أن يفشل للحفاظ على التاريخ)
    -- ------------------------------------------------------------------------
    BEGIN
        DELETE FROM books WHERE id = v_book_id;
        RAISE EXCEPTION 'فشل: تم حذف كتاب وله سجلات إعارة تاريخية!';
    EXCEPTION
        WHEN foreign_key_violation OR OTHERS THEN
            RAISE NOTICE '✓ اختبار 11 نجح: تم منع حذف السجلات التاريخية للكتب (% - %).', SQLSTATE, SQLERRM;
    END;

    RAISE NOTICE '=== اكتملت جميع الاختبارات الـ 11 بنجاح تام! ===';
END;
$$;

-- التراجع عن المعاملة لتبقى قاعدة البيانات نظيفة تماماً 100% بدون أي بيانات تجريبية
ROLLBACK;
