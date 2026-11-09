-- ==============================================================================
-- CAMPUSFORGE: INITIAL SEED DATA SCRIPT
-- Seeds standardized skills, test accounts for GEHU Bhimtal, and realistic drives
-- Default Password for all seeded users: Password@123
-- ==============================================================================

USE campus_forge;

-- 1. SEED SKILLS
INSERT INTO skills (skill_name, category) VALUES
-- Web & Full Stack
('React', 'TECHNICAL'),
('Node.js', 'TECHNICAL'),
('Express.js', 'TECHNICAL'),
('JavaScript', 'TECHNICAL'),
('TypeScript', 'TECHNICAL'),
('HTML5', 'TECHNICAL'),
('CSS3', 'TECHNICAL'),
('Tailwind CSS', 'TECHNICAL'),
('Next.js', 'TECHNICAL'),
-- Backend & Databases
('Python', 'TECHNICAL'),
('Java', 'TECHNICAL'),
('C++', 'TECHNICAL'),
('C', 'TECHNICAL'),
('SQL', 'TECHNICAL'),
('MySQL', 'TECHNICAL'),
('PostgreSQL', 'TECHNICAL'),
('MongoDB', 'TECHNICAL'),
('Redis', 'TECHNICAL'),
-- Cloud & Tools
('Docker', 'TECHNICAL'),
('AWS', 'TECHNICAL'),
('Git', 'TECHNICAL'),
('Linux', 'TECHNICAL'),
('REST APIs', 'TECHNICAL'),
-- AI & Data Science
('Machine Learning', 'TECHNICAL'),
('PyTorch', 'TECHNICAL'),
('TensorFlow', 'TECHNICAL'),
('Pandas', 'TECHNICAL'),
('NumPy', 'TECHNICAL'),
-- Core Engineering & Hardware
('Embedded Systems', 'CORE_ENGINEERING'),
('IoT', 'CORE_ENGINEERING'),
('Arduino', 'CORE_ENGINEERING'),
('Raspberry Pi', 'CORE_ENGINEERING'),
('VLSI', 'CORE_ENGINEERING'),
('Verilog', 'CORE_ENGINEERING'),
('MATLAB', 'CORE_ENGINEERING')
ON DUPLICATE KEY UPDATE skill_name=VALUES(skill_name);

-- 2. SEED USERS (Bcrypt hash for 'Password@123')
INSERT INTO users (id, email, password_hash, full_name, user_type) VALUES
(1, 'tpo@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Dr. Rajesh Sharma', 'ADMIN'),
(2, 'prof.verma@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Prof. Amit Verma', 'FACULTY'),
(3, 'prof.neha@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Dr. Neha Joshi', 'FACULTY'),
(4, 'rahul.rawat@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Rahul Rawat', 'STUDENT'),
(5, 'priya.bisht@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Priya Bisht', 'STUDENT'),
(6, 'vikram.joshi@gehu.ac.in', '$2a$10$2wvqXrn.B32gTRtRsMCvPuMshTbC.zekDyGf9MddZvGRK1kWnRI5e', 'Vikram Joshi', 'STUDENT')
ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash);

-- 3. SEED SUBCLASSES (admins, faculty, students)
INSERT INTO admins (user_id, employee_code, tpo_role, office_extension) VALUES
(1, 'GEHU-TPO-01', 'Head Training & Placement Officer', 'Ext-402')
ON DUPLICATE KEY UPDATE employee_code=VALUES(employee_code);

INSERT INTO faculty (user_id, employee_code, department, designation, cabin_location, phone_number) VALUES
(2, 'GEHU-FAC-101', 'CSE', 'Associate Professor', 'Block-B Cabin 204', '+91 9876543210'),
(3, 'GEHU-FAC-102', 'ECE', 'Assistant Professor', 'Block-C Cabin 108', '+91 9876543211')
ON DUPLICATE KEY UPDATE employee_code=VALUES(employee_code);

INSERT INTO students (user_id, roll_number, department, cgpa, batch_year, current_semester, resume_raw_text) VALUES
(4, '240101001', 'CSE', 8.50, 2026, 6, 'Full Stack Web Developer with strong skills in React, Node.js, Express, MySQL, and Python. Built multiple web apps and REST APIs.'),
(5, '240101002', 'CSE', 7.40, 2026, 6, 'Aspiring Data Analyst and Python programmer. Familiar with SQL, Pandas, NumPy, and Machine Learning algorithms.'),
(6, '240102015', 'ECE', 8.10, 2026, 6, 'Electronics and Embedded Systems enthusiast. Experienced with IoT, Arduino, Raspberry Pi, C++, and microcontrollers.')
ON DUPLICATE KEY UPDATE roll_number=VALUES(roll_number);

-- 4. SEED STUDENT SKILLS (Connecting students to skills)
INSERT INTO student_skills (student_id, skill_id, proficiency_level) VALUES
-- Rahul (CSE): React, Node.js, MySQL, Python, Git
(4, (SELECT id FROM skills WHERE skill_name='React'), 'ADVANCED'),
(4, (SELECT id FROM skills WHERE skill_name='Node.js'), 'ADVANCED'),
(4, (SELECT id FROM skills WHERE skill_name='MySQL'), 'INTERMEDIATE'),
(4, (SELECT id FROM skills WHERE skill_name='Python'), 'INTERMEDIATE'),
(4, (SELECT id FROM skills WHERE skill_name='Git'), 'INTERMEDIATE'),
-- Priya (CSE): Python, SQL, Machine Learning
(5, (SELECT id FROM skills WHERE skill_name='Python'), 'INTERMEDIATE'),
(5, (SELECT id FROM skills WHERE skill_name='SQL'), 'INTERMEDIATE'),
(5, (SELECT id FROM skills WHERE skill_name='Machine Learning'), 'BEGINNER'),
-- Vikram (ECE): Embedded Systems, IoT, Arduino, C++
(6, (SELECT id FROM skills WHERE skill_name='Embedded Systems'), 'ADVANCED'),
(6, (SELECT id FROM skills WHERE skill_name='IoT'), 'ADVANCED'),
(6, (SELECT id FROM skills WHERE skill_name='Arduino'), 'ADVANCED'),
(6, (SELECT id FROM skills WHERE skill_name='C++'), 'INTERMEDIATE')
ON DUPLICATE KEY UPDATE proficiency_level=VALUES(proficiency_level);

-- 5. SEED INTERNSHIPS (From Faculty WhatsApp and Scraped Feeds)
INSERT INTO internships (id, title, company_name, work_mode, location, stipend_amount, min_cgpa, eligible_branches, apply_url, description, source, posted_by_faculty_id, verification_status, verified_by_admin_id, deadline) VALUES
(1, 'Full Stack Developer Intern', 'Zomato Tech Labs', 'HYBRID', 'Gurugram', '₹35,000 / month', 7.50, 'CSE,IT', 'https://careers.zomato.com/jobs/sde-intern', 'Looking for Full Stack interns proficient in React, Node.js, and SQL to work on food ordering microservices.', 'LINKEDIN_PUBLIC', NULL, 'VERIFIED', 1, DATE_ADD(NOW(), INTERVAL 5 DAY)),
(2, 'Backend Engineering Intern', 'Razorpay', 'REMOTE', 'Remote', '₹40,000 / month', 7.00, 'CSE,IT,ECE', 'https://unstop.com/internships/razorpay-backend', 'Build high-scale financial payment APIs using Node.js, Python, and MySQL. Selected via Unstop challenge.', 'UNSTOP', NULL, 'VERIFIED', 1, DATE_ADD(NOW(), INTERVAL 12 DAY)),
(3, 'Embedded Firmware Trainee', 'DRDO / Bharat Electronics', 'ON_SITE', 'Dehradun', '₹20,000 / month', 7.50, 'ECE,EE,CSE', 'https://bel-india.in/careers', 'Hardware firmware development using C++, Embedded Systems, and IoT sensor networks. Core research project.', 'FACULTY_WHATSAPP', 3, 'VERIFIED', 1, DATE_ADD(NOW(), INTERVAL 20 DAY)),
(4, 'Campus Drive: Infosys Springboard', 'Infosys', 'REMOTE', 'Virtual', '₹25,000 / month', 6.50, 'ALL', 'https://infyspringboard.onwingspan.com', 'Exclusive campus internship drive shared by Prof. Amit Verma via departmental WhatsApp circular.', 'FACULTY_WHATSAPP', 2, 'VERIFIED', 1, DATE_ADD(NOW(), INTERVAL 2 DAY)),
(5, 'AI / Machine Learning Intern', 'Microsoft Research India', 'HYBRID', 'Bengaluru', '₹80,000 / month', 8.50, 'CSE,IT', 'https://careers.microsoft.com/students', 'Research internship on deep neural models. Ingested from FAANG feed; currently awaiting TPO verification.', 'MAANG_FEED', NULL, 'PENDING', NULL, DATE_ADD(NOW(), INTERVAL 15 DAY))
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 6. SEED INTERNSHIP REQUIRED SKILLS
INSERT INTO internship_required_skills (internship_id, skill_id, is_mandatory) VALUES
-- Job 1 (Zomato): React, Node.js, MySQL
(1, (SELECT id FROM skills WHERE skill_name='React'), TRUE),
(1, (SELECT id FROM skills WHERE skill_name='Node.js'), TRUE),
(1, (SELECT id FROM skills WHERE skill_name='MySQL'), FALSE),
-- Job 2 (Razorpay): Node.js, Python, SQL
(2, (SELECT id FROM skills WHERE skill_name='Node.js'), TRUE),
(2, (SELECT id FROM skills WHERE skill_name='Python'), FALSE),
(2, (SELECT id FROM skills WHERE skill_name='SQL'), TRUE),
-- Job 3 (DRDO Embedded): Embedded Systems, C++, IoT
(3, (SELECT id FROM skills WHERE skill_name='Embedded Systems'), TRUE),
(3, (SELECT id FROM skills WHERE skill_name='C++'), TRUE),
(3, (SELECT id FROM skills WHERE skill_name='IoT'), FALSE),
-- Job 4 (Infosys): Python, SQL
(4, (SELECT id FROM skills WHERE skill_name='Python'), TRUE),
(4, (SELECT id FROM skills WHERE skill_name='SQL'), FALSE),
-- Job 5 (Microsoft AI): Python, Machine Learning, PyTorch
(5, (SELECT id FROM skills WHERE skill_name='Python'), TRUE),
(5, (SELECT id FROM skills WHERE skill_name='Machine Learning'), TRUE),
(5, (SELECT id FROM skills WHERE skill_name='PyTorch'), FALSE)
ON DUPLICATE KEY UPDATE is_mandatory=VALUES(is_mandatory);

-- 7. SEED MLFQ SCHEDULER STATE (Operating System Engine)
INSERT INTO mlfq_scheduler_state (internship_id, current_queue, quantum_remaining_hours, total_impressions, apply_clicks, starvation_counter, aging_boost_score, final_priority_score) VALUES
-- Job 1: Standard Verified (Q1)
(1, 1, 96, 120, 15, 0, 0.00, 85.00),
-- Job 2: Standard Verified (Q1)
(2, 1, 80, 95, 8, 1, 5.00, 80.00),
-- Job 3: STARVATION CANDIDATE! Core ECE Job, 0 clicks, sitting in Q2, aged!
(3, 2, 240, 45, 0, 5, 25.00, 65.00),
-- Job 4: URGENT Campus Drive (< 48h to deadline), placed in Queue 0!
(4, 0, 48, 210, 42, 0, 0.00, 95.00)
ON DUPLICATE KEY UPDATE final_priority_score=VALUES(final_priority_score);
