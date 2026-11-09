/**
 * CONCEPT EXPLANATION: Server-Side Input Validation
 * ------------------------------------------------
 * Never trust raw data sent from a browser or API client.
 * Bad data (like empty fields, negative CGPA, or fake emails) can corrupt
 * our database tables or crash the server.
 * 
 * This utility sanitizes and checks all fields before our database is touched.
 */

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    // Standard email pattern: something@domain.extension
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

function isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    // Minimum 6 characters for security
    return password.length >= 6;
}

function isValidCGPA(cgpa) {
    const num = parseFloat(cgpa);
    return !isNaN(num) && num >= 0.0 && num <= 10.0;
}

function validateStudentRegistration(body) {
    const errors = [];
    const { full_name, email, password, roll_number, department, cgpa, batch_year } = body;

    if (!full_name || full_name.trim().length < 2) {
        errors.push('Full name must be at least 2 characters long.');
    }
    if (!isValidEmail(email)) {
        errors.push('Please provide a valid email address.');
    }
    if (!isValidPassword(password)) {
        errors.push('Password must be at least 6 characters long.');
    }
    if (!roll_number || roll_number.trim().length === 0) {
        errors.push('University roll number is required.');
    }
    if (!department || department.trim().length === 0) {
        errors.push('Department (e.g. CSE, ECE, MECH) is required.');
    }
    if (cgpa === undefined || !isValidCGPA(cgpa)) {
        errors.push('CGPA must be a valid number between 0.00 and 10.00.');
    }
    if (!batch_year || isNaN(parseInt(batch_year, 10))) {
        errors.push('A valid graduation batch year (e.g. 2026) is required.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateFacultyRegistration(body) {
    const errors = [];
    const { full_name, email, password, employee_code, department, designation, faculty_secret_code } = body;

    if (!full_name || full_name.trim().length < 2) {
        errors.push('Full name must be at least 2 characters long.');
    }
    if (!isValidEmail(email)) {
        errors.push('Please provide a valid email address.');
    }
    if (!isValidPassword(password)) {
        errors.push('Password must be at least 6 characters long.');
    }
    if (!employee_code || employee_code.trim().length === 0) {
        errors.push('Faculty employee code is required.');
    }
    if (!department || department.trim().length === 0) {
        errors.push('Department (e.g. CSE, ECE) is required.');
    }
    if (!designation || designation.trim().length === 0) {
        errors.push('Designation (e.g. Assistant Professor, HOD) is required.');
    }
    if (!faculty_secret_code || faculty_secret_code.trim().length === 0) {
        errors.push('Departmental secret passcode is required for faculty verification.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    isValidEmail,
    isValidPassword,
    isValidCGPA,
    validateStudentRegistration,
    validateFacultyRegistration
};
