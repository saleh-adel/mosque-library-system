BEGIN;

-- 1. Test: Librarian must have mosque_id
DO $$
BEGIN
    INSERT INTO users (role, username, full_name, password_hash)
    VALUES ('librarian', 'test_lib', 'Test Lib', 'hash123');
    RAISE EXCEPTION 'CHECK FAILED: Librarian was inserted without mosque_id!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'SUCCESS: chk_librarian_requires_mosque prevented librarian without mosque_id.';
END;
$$;

-- 2. Test: Prevent concurrent active loans on the same copy
DO $$
DECLARE
    v_mosque_id UUID;
    v_admin_id UUID;
    v_member1_id UUID;
    v_member2_id UUID;
    v_book_id UUID;
    v_copy_id UUID;
BEGIN
    INSERT INTO mosques (code, name, city) VALUES ('TEST-M1', 'مسجد التجربة', 'الرياض') RETURNING id INTO v_mosque_id;
    INSERT INTO users (role, username, full_name, password_hash) VALUES ('admin', 'test_admin', 'Admin', 'h1') RETURNING id INTO v_admin_id;
    INSERT INTO users (role, username, full_name, password_hash) VALUES ('member', 'member1', 'M1', 'h2') RETURNING id INTO v_member1_id;
    INSERT INTO users (role, username, full_name, password_hash) VALUES ('member', 'member2', 'M2', 'h3') RETURNING id INTO v_member2_id;
    INSERT INTO books (title, author) VALUES ('كتاب تجريبي', 'مؤلف تجريبي') RETURNING id INTO v_book_id;
    INSERT INTO book_copies (book_id, mosque_id, barcode) VALUES (v_book_id, v_mosque_id, 'BARCODE-TEST-1') RETURNING id INTO v_copy_id;

    -- First active loan
    INSERT INTO loans (copy_id, user_id, mosque_id, loaned_by, due_date, status)
    VALUES (v_copy_id, v_member1_id, v_mosque_id, v_admin_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');

    -- Second active loan on same copy (MUST FAIL)
    BEGIN
        INSERT INTO loans (copy_id, user_id, mosque_id, loaned_by, due_date, status)
        VALUES (v_copy_id, v_member2_id, v_mosque_id, v_admin_id, CURRENT_TIMESTAMP + INTERVAL '7 days', 'active');
        RAISE EXCEPTION 'CHECK FAILED: Double loan was permitted!';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'SUCCESS: uq_active_loan_per_copy prevented duplicate active loan on same copy.';
    END;
END;
$$;

-- ROLLBACK to keep the database completely clean (Requirement 12: no dummy data)
ROLLBACK;
