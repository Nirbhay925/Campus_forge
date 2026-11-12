-- ==============================================================================
-- CAMPUSFORGE: RELATIONAL DATABASE SCHEMA (MySQL 8.0)
-- Architecture: Enhanced Entity-Relationship (EER) with Disjoint Specialization (ISA)
-- Normalization: Strict Third Normal Form (3NF) Compliance
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS campus_forge 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE campus_forge;

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE (Superclass Entity)
-- Holds common authentication and identification credentials across all roles.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    user_type ENUM('STUDENT', 'FACULTY', 'ADMIN') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    active_session_token VARCHAR(255) NULL,
    active_device_info VARCHAR(255) NULL,
    last_active_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_type (user_type),
    INDEX idx_user_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 1B. EMAIL VERIFICATIONS TABLE (OTP Authentication Gate)
-- Stores 6-digit one-time passwords for first-time GEHU student onboarding.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_verif_email (email),
    INDEX idx_verif_roll (roll_number)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 2. STUDENTS TABLE (Subclass Entity - 1:1 with users)
-- Specializes user into a student, holding academic & resume attributes.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    user_id INT PRIMARY KEY,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    cgpa DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    batch_year INT NOT NULL,
    current_semester TINYINT NOT NULL DEFAULT 1,
    resume_url VARCHAR(255) NULL,
    resume_raw_text MEDIUMTEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_student_cgpa (cgpa),
    INDEX idx_student_dept (department)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 3. FACULTY TABLE (Subclass Entity - 1:1 with users)
-- Specializes user into a professor who creates on-campus drives.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty (
    user_id INT PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    cabin_location VARCHAR(100) NULL,
    phone_number VARCHAR(20) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_faculty_dept (department)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 4. ADMINS TABLE (Subclass Entity - 1:1 with users)
-- Specializes user into a Training & Placement Cell (TPO) Officer.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    user_id INT PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    tpo_role VARCHAR(100) NOT NULL DEFAULT 'Placement Coordinator',
    office_extension VARCHAR(50) NULL,
    can_verify_postings BOOLEAN NOT NULL DEFAULT TRUE,
    can_trigger_aging BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 5. SKILLS MASTER TABLE (Lookup Entity)
-- Standardized dictionary of technical and engineering skills.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL'
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 6. STUDENT_SKILLS TABLE (Associative Junction - M:N)
-- Resolves Many-to-Many relationship between Students and Skills.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') DEFAULT 'INTERMEDIATE',
    extracted_from_resume BOOLEAN DEFAULT TRUE,
    UNIQUE KEY uq_student_skill (student_id, skill_id),
    FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 7. INTERNSHIPS TABLE (Core Opportunity Entity)
-- Holds all verified and pending opportunities from faculty and scrapers.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    work_mode ENUM('REMOTE', 'HYBRID', 'ON_SITE') DEFAULT 'REMOTE',
    location VARCHAR(100) DEFAULT 'Remote',
    stipend_amount VARCHAR(100) DEFAULT 'Unspecified',
    min_cgpa DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    eligible_branches VARCHAR(255) NOT NULL DEFAULT 'ALL',
    apply_url TEXT NOT NULL,
    description TEXT NOT NULL,
    source ENUM('FACULTY_WHATSAPP', 'UNSTOP', 'LINKEDIN_PUBLIC', 'MAANG_FEED') NOT NULL,
    posted_by_faculty_id INT NULL,
    verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING',
    verified_by_admin_id INT NULL,
    deadline DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (posted_by_faculty_id) REFERENCES faculty(user_id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by_admin_id) REFERENCES admins(user_id) ON DELETE SET NULL,
    INDEX idx_internship_status (verification_status),
    INDEX idx_internship_cgpa (min_cgpa),
    INDEX idx_internship_deadline (deadline)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 8. INTERNSHIP_REQUIRED_SKILLS TABLE (Associative Junction - M:N)
-- Maps required skills to each job posting for candidate matching calculations.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internship_required_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    skill_id INT NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE,
    UNIQUE KEY uq_internship_skill (internship_id, skill_id),
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 9. MLFQ_SCHEDULER_STATE TABLE (OS Engine State - 1:1 with internships)
-- Maintains Operating System scheduling levels, starvation, and aging telemetry.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mlfq_scheduler_state (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL UNIQUE,
    current_queue TINYINT NOT NULL DEFAULT 0, -- 0: Urgent (48h), 1: Standard (5d), 2: Background
    quantum_remaining_hours INT NOT NULL DEFAULT 48,
    total_impressions INT NOT NULL DEFAULT 0,
    apply_clicks INT NOT NULL DEFAULT 0,
    starvation_counter INT NOT NULL DEFAULT 0,
    aging_boost_score DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    final_priority_score DECIMAL(8,2) NOT NULL DEFAULT 100.00,
    last_state_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    INDEX idx_mlfq_priority (final_priority_score DESC),
    INDEX idx_mlfq_queue (current_queue)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 10. APPLICATIONS_TRACKER TABLE (Transaction Log - Student Interaction)
-- Captures each student's 'Apply Now' clicks and logs their interaction.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications_tracker (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    internship_id INT NOT NULL,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('CLICKED_APPLY', 'CONFIRMED_APPLIED', 'SHORTLISTED', 'REJECTED') DEFAULT 'CLICKED_APPLY',
    UNIQUE KEY uq_student_internship (student_id, internship_id),
    FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 11. SCHEDULER_AUDIT_LOGS TABLE (Proof of OS Logic for College Evaluators)
-- Immutable audit log recording every queue demotion or aging boost action.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduler_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    action_type ENUM('QUANTUM_EXPIRE_DEMOTE', 'AGING_PROMOTION', 'STARVATION_RESCUE', 'PRIORITY_BOOST_CYCLE') NOT NULL,
    old_queue TINYINT NOT NULL,
    new_queue TINYINT NOT NULL,
    aging_score_applied DECIMAL(6,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
) ENGINE=InnoDB;
