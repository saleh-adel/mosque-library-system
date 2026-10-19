--
-- PostgreSQL database dump
--

\restrict YWgtVHprfaAMgkLG7uPu5vtaQwzaRaWArYFdOlhaBmckrmevwUsKOt396UJRZhT

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: fn_validate_loan_staff_and_borrower(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validate_loan_staff_and_borrower() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_timestamp_and_sync_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp_and_sync_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.sync_version = OLD.sync_version + 1;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: book_copies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_copies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid NOT NULL,
    mosque_id uuid NOT NULL,
    barcode character varying(100) NOT NULL,
    shelf_location character varying(100),
    condition character varying(30) DEFAULT 'good'::character varying NOT NULL,
    status character varying(30) DEFAULT 'available'::character varying NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT book_copies_condition_check CHECK (((condition)::text = ANY ((ARRAY['new'::character varying, 'good'::character varying, 'fair'::character varying, 'damaged'::character varying, 'lost'::character varying])::text[]))),
    CONSTRAINT book_copies_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'borrowed'::character varying, 'reserved'::character varying, 'maintenance'::character varying, 'withdrawn'::character varying])::text[]))),
    CONSTRAINT chk_book_copies_archive_consistency CHECK (((is_archived = false) OR ((is_archived = true) AND (archived_at IS NOT NULL))))
);


--
-- Name: books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    isbn character varying(20),
    title character varying(500) NOT NULL,
    author character varying(300) NOT NULL,
    publisher character varying(255),
    publication_year integer,
    edition character varying(50),
    category character varying(150),
    dewey_decimal character varying(50),
    language character varying(50) DEFAULT 'ar'::character varying NOT NULL,
    page_count integer,
    description text,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archive_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT books_page_count_check CHECK ((page_count > 0)),
    CONSTRAINT books_publication_year_check CHECK ((publication_year > 0)),
    CONSTRAINT chk_books_archive_consistency CHECK (((is_archived = false) OR ((is_archived = true) AND (archived_at IS NOT NULL))))
);


--
-- Name: ebook_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ebook_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_format character varying(20) NOT NULL,
    file_size_bytes bigint NOT NULL,
    checksum_sha256 character varying(64),
    is_public boolean DEFAULT false NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT ebook_files_file_format_check CHECK (((file_format)::text = ANY ((ARRAY['pdf'::character varying, 'epub'::character varying, 'mobi'::character varying, 'docx'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ebook_files_file_size_bytes_check CHECK ((file_size_bytes > 0))
);


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    copy_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mosque_id uuid NOT NULL,
    loaned_by uuid NOT NULL,
    received_by uuid,
    loan_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    due_date timestamp with time zone NOT NULL,
    return_date timestamp with time zone,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT chk_due_after_loan CHECK ((due_date >= loan_date)),
    CONSTRAINT chk_loan_return_consistency CHECK (((((status)::text = 'returned'::text) AND (return_date IS NOT NULL)) OR (((status)::text = ANY ((ARRAY['active'::character varying, 'overdue'::character varying, 'lost'::character varying])::text[])) AND (return_date IS NULL)))),
    CONSTRAINT chk_return_after_loan CHECK (((return_date IS NULL) OR (return_date >= loan_date))),
    CONSTRAINT loans_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'returned'::character varying, 'overdue'::character varying, 'lost'::character varying])::text[])))
);


--
-- Name: mosques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mosques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    district character varying(100),
    address text,
    phone character varying(50),
    email character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL
);


--
-- Name: sync_journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_journal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id character varying(100) NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id uuid NOT NULL,
    operation character varying(20) NOT NULL,
    payload jsonb,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    synced_at timestamp with time zone,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message text,
    CONSTRAINT sync_journal_operation_check CHECK (((operation)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[]))),
    CONSTRAINT sync_journal_sync_status_check CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'synced'::character varying, 'conflict'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mosque_id uuid,
    role character varying(20) NOT NULL,
    username character varying(100) NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    password_hash character varying(255) NOT NULL,
    membership_number character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT chk_librarian_requires_mosque CHECK ((((role)::text <> 'librarian'::text) OR (mosque_id IS NOT NULL))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'librarian'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: book_copies book_copies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_copies
    ADD CONSTRAINT book_copies_pkey PRIMARY KEY (id);


--
-- Name: books books_isbn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_isbn_key UNIQUE (isbn);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: ebook_files ebook_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebook_files
    ADD CONSTRAINT ebook_files_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: mosques mosques_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mosques
    ADD CONSTRAINT mosques_code_key UNIQUE (code);


--
-- Name: mosques mosques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mosques
    ADD CONSTRAINT mosques_pkey PRIMARY KEY (id);


--
-- Name: sync_journal sync_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_journal
    ADD CONSTRAINT sync_journal_pkey PRIMARY KEY (id);


--
-- Name: book_copies uq_book_copies_id_mosque; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_copies
    ADD CONSTRAINT uq_book_copies_id_mosque UNIQUE (id, mosque_id);


--
-- Name: book_copies uq_book_copies_mosque_barcode; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_copies
    ADD CONSTRAINT uq_book_copies_mosque_barcode UNIQUE (mosque_id, barcode);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_membership_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_membership_number_key UNIQUE (membership_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_book_copies_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_book_copies_barcode ON public.book_copies USING btree (barcode);


--
-- Name: idx_book_copies_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_book_copies_book_id ON public.book_copies USING btree (book_id);


--
-- Name: idx_book_copies_mosque_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_book_copies_mosque_id ON public.book_copies USING btree (mosque_id);


--
-- Name: idx_book_copies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_book_copies_status ON public.book_copies USING btree (status);


--
-- Name: idx_books_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_author ON public.books USING btree (author);


--
-- Name: idx_books_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_category ON public.books USING btree (category);


--
-- Name: idx_books_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_is_archived ON public.books USING btree (is_archived);


--
-- Name: idx_books_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_title ON public.books USING btree (title);


--
-- Name: idx_ebook_files_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ebook_files_book_id ON public.ebook_files USING btree (book_id);


--
-- Name: idx_loans_copy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_copy_id ON public.loans USING btree (copy_id);


--
-- Name: idx_loans_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_due_date ON public.loans USING btree (due_date);


--
-- Name: idx_loans_mosque_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_mosque_id ON public.loans USING btree (mosque_id);


--
-- Name: idx_loans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_status ON public.loans USING btree (status);


--
-- Name: idx_loans_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_user_id ON public.loans USING btree (user_id);


--
-- Name: idx_sync_journal_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_journal_record ON public.sync_journal USING btree (table_name, record_id);


--
-- Name: idx_sync_journal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_journal_status ON public.sync_journal USING btree (sync_status, occurred_at);


--
-- Name: idx_users_mosque_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_mosque_id ON public.users USING btree (mosque_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: uq_active_loan_per_copy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_active_loan_per_copy ON public.loans USING btree (copy_id) WHERE (((status)::text = ANY ((ARRAY['active'::character varying, 'overdue'::character varying])::text[])) AND (return_date IS NULL));


--
-- Name: book_copies trg_book_copies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_book_copies_updated_at BEFORE UPDATE ON public.book_copies FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: books trg_books_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: ebook_files trg_ebook_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ebook_files_updated_at BEFORE UPDATE ON public.ebook_files FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: loans trg_loans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: mosques trg_mosques_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mosques_updated_at BEFORE UPDATE ON public.mosques FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp_and_sync_version();


--
-- Name: loans trg_validate_loan_staff; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_loan_staff BEFORE INSERT OR UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.fn_validate_loan_staff_and_borrower();


--
-- Name: book_copies book_copies_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_copies
    ADD CONSTRAINT book_copies_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE RESTRICT;


--
-- Name: book_copies book_copies_mosque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_copies
    ADD CONSTRAINT book_copies_mosque_id_fkey FOREIGN KEY (mosque_id) REFERENCES public.mosques(id) ON DELETE RESTRICT;


--
-- Name: ebook_files ebook_files_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebook_files
    ADD CONSTRAINT ebook_files_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE RESTRICT;


--
-- Name: ebook_files ebook_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ebook_files
    ADD CONSTRAINT ebook_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loans fk_loans_copy_mosque; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT fk_loans_copy_mosque FOREIGN KEY (copy_id, mosque_id) REFERENCES public.book_copies(id, mosque_id) ON DELETE RESTRICT;


--
-- Name: loans loans_loaned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_loaned_by_fkey FOREIGN KEY (loaned_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: loans loans_mosque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_mosque_id_fkey FOREIGN KEY (mosque_id) REFERENCES public.mosques(id) ON DELETE RESTRICT;


--
-- Name: loans loans_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: loans loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: users users_mosque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mosque_id_fkey FOREIGN KEY (mosque_id) REFERENCES public.mosques(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict YWgtVHprfaAMgkLG7uPu5vtaQwzaRaWArYFdOlhaBmckrmevwUsKOt396UJRZhT

