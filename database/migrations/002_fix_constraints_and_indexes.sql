-- ============================================================================
-- ترحيل رقم 002: تصحيح القيود والعلاقات وتنظيف الفهارس المكررة
-- المشروع: نظام إدارة المكتبات المترابطة للمساجد
-- قاعدة البيانات: mosque_library
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. تنظيف الفهارس المكررة (Clean up Redundant Indexes)
-- ----------------------------------------------------------------------------

-- الفهرس idx_users_username مكرر تماماً لوجود القيد الفريد users_username_key
DROP INDEX IF EXISTS idx_users_username;

-- الفهرس idx_books_isbn مكرر تماماً لوجود القيد الفريد books_isbn_key
DROP INDEX IF EXISTS idx_books_isbn;

-- ملاحظة بشأن idx_book_copies_barcode:
-- تم الإبقاء عليه عمداً لأن قيد الفرادة الجديد أصبح مركباً (mosque_id, barcode)
-- وبالتالي فالبحث برمز الباركود وحده دون معرفة المسجد يحتاج فهرس idx_book_copies_barcode.


-- ----------------------------------------------------------------------------
-- 2. جعل الباركود فريداً على مستوى المسجد الواحد (Scoped Barcode Uniqueness)
-- ----------------------------------------------------------------------------

-- إزالة قيد فرادة الباركود العام القديم
ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS book_copies_barcode_key;

-- إضافة قيد فرادة الباركود داخل المسجد الواحد
ALTER TABLE book_copies ADD CONSTRAINT uq_book_copies_mosque_barcode UNIQUE (mosque_id, barcode);


-- ----------------------------------------------------------------------------
-- 3. ضمان تطابق مسجد الإعارة مع مسجد النسخة الفيزيائية (Relational Integrity)
-- ----------------------------------------------------------------------------

-- إضافة قيد مركب فريد في جدول النسخ يتيح الربط المشترك
ALTER TABLE book_copies ADD CONSTRAINT uq_book_copies_id_mosque UNIQUE (id, mosque_id);

-- استبدال المفتاح الأجنبي البسيط بمفتاح أجنبي مركب يربط (النسخة والمسجد) معاً
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_copy_id_fkey;
ALTER TABLE loans ADD CONSTRAINT fk_loans_copy_mosque 
    FOREIGN KEY (copy_id, mosque_id) REFERENCES book_copies (id, mosque_id) ON DELETE RESTRICT;


-- ----------------------------------------------------------------------------
-- 4. قيود اتساق حالات الإعارة وتواريخ الإرجاع والأرشفة (Consistency Constraints)
-- ----------------------------------------------------------------------------

-- ضمان اتساق حالة الإرجاع مع تاريخ الإرجاع الفعلي
ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loan_return_consistency;
ALTER TABLE loans ADD CONSTRAINT chk_loan_return_consistency CHECK (
    (status = 'returned' AND return_date IS NOT NULL) OR
    (status IN ('active', 'overdue', 'lost') AND return_date IS NULL)
);

-- ضمان اتساق حالة الأرشفة مع تاريخ الأرشفة في جدول الكتب
ALTER TABLE books DROP CONSTRAINT IF EXISTS chk_books_archive_consistency;
ALTER TABLE books ADD CONSTRAINT chk_books_archive_consistency CHECK (
    (is_archived = FALSE) OR (is_archived = TRUE AND archived_at IS NOT NULL)
);

-- ضمان اتساق حالة الأرشفة مع تاريخ الأرشفة في جدول النسخ
ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS chk_book_copies_archive_consistency;
ALTER TABLE book_copies ADD CONSTRAINT chk_book_copies_archive_consistency CHECK (
    (is_archived = FALSE) OR (is_archived = TRUE AND archived_at IS NOT NULL)
);


-- ----------------------------------------------------------------------------
-- 5. التحقق من صلاحيات موظف الإعارة وأهلية المستعير (Staff & Borrower Validation)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_loan_staff_and_borrower()
RETURNS TRIGGER AS $$
DECLARE
    v_staff_role VARCHAR(20);
    v_staff_mosque UUID;
    v_staff_active BOOLEAN;
    v_recv_role VARCHAR(20);
    v_recv_mosque UUID;
    v_recv_active BOOLEAN;
    v_borrower_active BOOLEAN;
BEGIN
    -- 1. التحقق من أهلية المستعير (user_id)
    SELECT is_active INTO v_borrower_active
    FROM users WHERE id = NEW.user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستعير غير موجود في النظام.';
    END IF;

    IF NOT v_borrower_active THEN
        RAISE EXCEPTION 'حساب المستعير معطّل ولا يمكن تسجيل إعارة له.';
    END IF;

    -- 2. التحقق من صلاحية الموظف المنفذ للإعارة (loaned_by)
    SELECT role, mosque_id, is_active
    INTO v_staff_role, v_staff_mosque, v_staff_active
    FROM users WHERE id = NEW.loaned_by;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الموظف المنفذ للإعارة غير موجود.';
    END IF;

    IF NOT v_staff_active THEN
        RAISE EXCEPTION 'حساب الموظف المنفذ للإعارة معطّل.';
    END IF;

    IF v_staff_role NOT IN ('admin', 'librarian') THEN
        RAISE EXCEPTION 'المستخدم المنفذ للإعارة ليس لديه صلاحية أمين مكتبة أو مشرف (الدور: %)', v_staff_role;
    END IF;

    -- أمين المكتبة مقيّد بمسجده فقط، بينما المشرف العام (admin) يملك صلاحية على كل المساجد
    IF v_staff_role = 'librarian' AND (v_staff_mosque IS NULL OR v_staff_mosque <> NEW.mosque_id) THEN
        RAISE EXCEPTION 'أمين المكتبة غير مخوّل بالعمل في هذا المسجد (مسجد الأمين: %، مسجد الإعارة: %)', v_staff_mosque, NEW.mosque_id;
    END IF;

    -- 3. التحقق من الموظف المستلم عند الإرجاع (received_by) في حال تم تحديده
    IF NEW.received_by IS NOT NULL THEN
        SELECT role, mosque_id, is_active
        INTO v_recv_role, v_recv_mosque, v_recv_active
        FROM users WHERE id = NEW.received_by;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'الموظف المستلم عند الإرجاع غير موجود.';
        END IF;

        IF NOT v_recv_active THEN
            RAISE EXCEPTION 'حساب الموظف المستلم معطّل.';
        END IF;

        IF v_recv_role NOT IN ('admin', 'librarian') THEN
            RAISE EXCEPTION 'المستخدم المستلم ليس لديه صلاحية أمين مكتبة أو مشرف (الدور: %)', v_recv_role;
        END IF;

        IF v_recv_role = 'librarian' AND (v_recv_mosque IS NULL OR v_recv_mosque <> NEW.mosque_id) THEN
            RAISE EXCEPTION 'أمين المكتبة المستلم غير مخوّل بالعمل في هذا المسجد (مسجد الأمين: %، مسجد الإعارة: %)', v_recv_mosque, NEW.mosque_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_loan_staff ON loans;
CREATE TRIGGER trg_validate_loan_staff
BEFORE INSERT OR UPDATE ON loans
FOR EACH ROW EXECUTE FUNCTION fn_validate_loan_staff_and_borrower();

COMMIT;
