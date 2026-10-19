
-- ----------------------------------------------------------------------------
-- 1. دوال مساعدة ومشتركة
-- ----------------------------------------------------------------------------

-- دالة التحديث التلقائي لحقل updated_at وزيادة رقم الإصدار sync_version للمزامنة
CREATE OR REPLACE FUNCTION update_timestamp_and_sync_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.sync_version = OLD.sync_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. جدول المساجد (mosques)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mosques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,                       -- رمز موحد للمسجد، مثل: MSQ-001
    name VARCHAR(255) NOT NULL,                             -- اسم المسجد
    city VARCHAR(100) NOT NULL,                             -- المدينة
    district VARCHAR(100),                                  -- الحي
    address TEXT,                                           -- العنوان التفصيلي
    phone VARCHAR(50),                                      -- رقم التواصل
    email VARCHAR(255),                                     -- البريد الإلكتروني للمسجد إن وجد
    is_active BOOLEAN DEFAULT TRUE NOT NULL,                -- حالة تفعيل المسجد في النظام
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL                  -- رقم إصدار السجل للمزامنة دون اتصال
);

-- ----------------------------------------------------------------------------
-- 3. جدول المستخدمين (users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mosque_id UUID REFERENCES mosques(id) ON DELETE RESTRICT, -- المسجد التابع له أمين المكتبة أو المستفيد
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'librarian', 'member')),
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,                    -- تجزئة مشفرة لكلمة المرور (Argon2id / bcrypt)
    membership_number VARCHAR(100) UNIQUE,                  -- رقم العضوية / البطاقة
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL,

    -- قيد: أمين المكتبة يجب أن يكون مرتبطاً بمسجد محدد لتطبيق صلاحياته محلياً
    CONSTRAINT chk_librarian_requires_mosque CHECK (
        role <> 'librarian' OR mosque_id IS NOT NULL
    )
);

-- ----------------------------------------------------------------------------
-- 4. جدول الفهرس العام للكتب (books)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn VARCHAR(20) UNIQUE,                                -- الترقيم الدولي الموحد للكتاب
    title VARCHAR(500) NOT NULL,                            -- عنوان الكتاب
    author VARCHAR(300) NOT NULL,                           -- المؤلف
    publisher VARCHAR(255),                                 -- دار النشر
    publication_year INTEGER CHECK (publication_year > 0),  -- سنة النشر
    edition VARCHAR(50),                                    -- رقم الطبعة
    category VARCHAR(150),                                  -- التصنيف الموضوعي (فقه، عقيدة، تفسير...)
    dewey_decimal VARCHAR(50),                              -- تصنيف ديوي العشري
    language VARCHAR(50) DEFAULT 'ar' NOT NULL,             -- لغة الكتاب
    page_count INTEGER CHECK (page_count > 0),              -- عدد الصفحات
    description TEXT,                                       -- نبذة عن الكتاب
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,             -- الحذف المنطقي للحفاظ على السجلات التاريخية
    archived_at TIMESTAMPTZ,                                -- تاريخ الأرشفة / سحب الكتاب
    archive_reason TEXT,                                    -- سبب السحب من التداول
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL,

    -- قيد اتساق الأرشفة: عند تعيين الكتاب كمؤرشف يجب وجود تاريخ الأرشفة
    CONSTRAINT chk_books_archive_consistency CHECK (
        (is_archived = FALSE) OR (is_archived = TRUE AND archived_at IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 5. جدول النسخ الورقية الموجودة في كل مسجد (book_copies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_copies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    mosque_id UUID NOT NULL REFERENCES mosques(id) ON DELETE RESTRICT,
    barcode VARCHAR(100) NOT NULL,                          -- باركود النسخة
    shelf_location VARCHAR(100),                            -- موقع الرف / الجناح داخل المسجد
    condition VARCHAR(30) DEFAULT 'good' NOT NULL 
        CHECK (condition IN ('new', 'good', 'fair', 'damaged', 'lost')),
    status VARCHAR(30) DEFAULT 'available' NOT NULL 
        CHECK (status IN ('available', 'borrowed', 'reserved', 'maintenance', 'withdrawn')),
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,             -- الحذف المنطقي
    archived_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL,

    -- قيد فرادة الباركود على مستوى المسجد الواحد
    CONSTRAINT uq_book_copies_mosque_barcode UNIQUE (mosque_id, barcode),

    -- قيد مركب فريد لدعم ربط الإعارة بالمسجد والنسخة معاً لضمان التطابق العلائقي
    CONSTRAINT uq_book_copies_id_mosque UNIQUE (id, mosque_id),

    -- قيد اتساق الأرشفة
    CONSTRAINT chk_book_copies_archive_consistency CHECK (
        (is_archived = FALSE) OR (is_archived = TRUE AND archived_at IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 6. جدول ملفات الكتب الإلكترونية (ebook_files)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ebook_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,                       -- مسار الملف على التخزين المحلي أو الشبكي
    file_format VARCHAR(20) NOT NULL 
        CHECK (file_format IN ('pdf', 'epub', 'mobi', 'docx', 'other')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    checksum_sha256 VARCHAR(64),                            -- للتحقق من سلامة الملف أثناء المزامنة
    is_public BOOLEAN DEFAULT FALSE NOT NULL,               -- إتاحة التحميل للجميع أم للأعضاء فقط
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. جدول سجلات الإعارة والإرجاع (loans)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,           -- المستعير
    mosque_id UUID NOT NULL REFERENCES mosques(id) ON DELETE RESTRICT,       -- مسجد النسخة
    loaned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,         -- الموظف المنفذ للإعارة
    received_by UUID REFERENCES users(id) ON DELETE RESTRICT,               -- الموظف المستلم عند الإرجاع
    loan_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,               -- تاريخ ووقت الإعارة
    due_date TIMESTAMPTZ NOT NULL,                                          -- تاريخ الاستحقاق
    return_date TIMESTAMPTZ,                                                -- تاريخ الإرجاع الفعلي
    status VARCHAR(30) DEFAULT 'active' NOT NULL 
        CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version BIGINT DEFAULT 1 NOT NULL,

    -- مفتاح أجنبي مركب يضمن حتمية تطابق مسجد الإعارة مع المسجد الذي تتبع له النسخة
    CONSTRAINT fk_loans_copy_mosque FOREIGN KEY (copy_id, mosque_id)
        REFERENCES book_copies (id, mosque_id) ON DELETE RESTRICT,

    -- قيد منطقي: تاريخ الإرجاع لا يمكن أن يكون قبل تاريخ الإعارة
    CONSTRAINT chk_return_after_loan CHECK (
        return_date IS NULL OR return_date >= loan_date
    ),
    -- قيد منطقي: تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإعارة
    CONSTRAINT chk_due_after_loan CHECK (
        due_date >= loan_date
    ),
    -- قيد اتساق حالة الإرجاع مع تاريخ الإرجاع
    CONSTRAINT chk_loan_return_consistency CHECK (
        (status = 'returned' AND return_date IS NOT NULL) OR
        (status IN ('active', 'overdue', 'lost') AND return_date IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 8. جدول سجل عمليات المزامنة دون اتصال (sync_journal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL,                          -- معرّف محطة العمل أو خادم المسجد المحلي
    table_name VARCHAR(100) NOT NULL,                       -- اسم الجدول المتأثر
    record_id UUID NOT NULL,                                -- معرّف السجل
    operation VARCHAR(20) NOT NULL 
        CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB,                                          -- بيانات السجل بصيغة JSON
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status VARCHAR(30) DEFAULT 'pending' NOT NULL 
        CHECK (sync_status IN ('pending', 'synced', 'conflict', 'failed')),
    synced_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    error_message TEXT
);

-- ----------------------------------------------------------------------------
-- 9. الفهارس والقيود المتقدمة (Indexes & Constraints)
-- ----------------------------------------------------------------------------

-- قيد جوهري: منع إعارة النسخة الورقية نفسها لأكثر من مستفيد في نفس الوقت
-- يتم ذلك عبر فهرس فريد جزئي (Partial Unique Index) على النسخ ذات الحالة النشطة/المتأخرة
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_loan_per_copy 
ON loans (copy_id) 
WHERE status IN ('active', 'overdue') AND return_date IS NULL;

-- فهارس تحسين الاستعلامات على جدول المستخدمين
CREATE INDEX IF NOT EXISTS idx_users_mosque_id ON users (mosque_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
-- ملاحظة: تم الاستغناء عن idx_users_username لوجود users_username_key تلقائياً

-- فهارس تحسين الاستعلامات والبحث على جدول الكتب
CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books (author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books (category);
CREATE INDEX IF NOT EXISTS idx_books_is_archived ON books (is_archived);
-- ملاحظة: تم الاستغناء عن idx_books_isbn لوجود books_isbn_key تلقائياً

-- فهارس النسخ الورقية
CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies (book_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_mosque_id ON book_copies (mosque_id);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies (status);
CREATE INDEX IF NOT EXISTS idx_book_copies_barcode ON book_copies (barcode);

-- فهارس الإعارات
CREATE INDEX IF NOT EXISTS idx_loans_copy_id ON loans (copy_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_mosque_id ON loans (mosque_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans (status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans (due_date);

-- فهارس الكتب الإلكترونية
CREATE INDEX IF NOT EXISTS idx_ebook_files_book_id ON ebook_files (book_id);

-- فهارس سجل المزامنة
CREATE INDEX IF NOT EXISTS idx_sync_journal_status ON sync_journal (sync_status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sync_journal_record ON sync_journal (table_name, record_id);

-- ----------------------------------------------------------------------------
-- 10. المحفزات (Triggers)
-- ----------------------------------------------------------------------------

-- ربط محفزات التحديث التلقائي لحقل updated_at و sync_version
DROP TRIGGER IF EXISTS trg_mosques_updated_at ON mosques;
CREATE TRIGGER trg_mosques_updated_at
BEFORE UPDATE ON mosques
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

DROP TRIGGER IF EXISTS trg_book_copies_updated_at ON book_copies;
CREATE TRIGGER trg_book_copies_updated_at
BEFORE UPDATE ON book_copies
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

DROP TRIGGER IF EXISTS trg_ebook_files_updated_at ON ebook_files;
CREATE TRIGGER trg_ebook_files_updated_at
BEFORE UPDATE ON ebook_files
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

DROP TRIGGER IF EXISTS trg_loans_updated_at ON loans;
CREATE TRIGGER trg_loans_updated_at
BEFORE UPDATE ON loans
FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_sync_version();

-- محفز التحقق من صلاحيات موظف الإعارة (أمين المكتبة/المشرف) وأهلية المستعير
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
