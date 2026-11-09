/**
 * CONCEPT EXPLANATION: WhatsApp Circular Heuristic Parser
 * -------------------------------------------------------
 * College faculty circulars on WhatsApp are informal and unstructured.
 * This service applies heuristic regular expressions (RegEx) to intelligently
 * detect and extract key fields from messy message strings:
 * - Application Link
 * - Company Name
 * - Job Title / Designation
 * - Stipend / Salary
 * - Minimum CGPA Cutoff
 * - Eligible Branches / Departments
 * - Application Deadline
 */

function parseWhatsAppMessage(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return {
            title: '',
            company_name: '',
            stipend_amount: 'Unspecified',
            min_cgpa: 0.0,
            eligible_branches: 'ALL',
            apply_url: '',
            deadline: null,
            work_mode: 'REMOTE',
            location: 'Remote',
            description: ''
        };
    }

    const cleanText = rawText.replace(/\r\n/g, '\n').trim();

    // 1. EXTRACT APPLY URL
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/i;
    const urlMatch = cleanText.match(urlRegex);
    const apply_url = urlMatch ? urlMatch[1] : '';

    // 2. EXTRACT MINIMUM CGPA
    let min_cgpa = 0.0;
    const cgpaRegex = /(?:min(?:imum)?[\s_-]*cgpa|cgpa[\s:=-]*cutoff|cutoff|cgpa)[\s:=-]*([0-9]\.[0-9]{1,2})/i;
    const cgpaMatch = cleanText.match(cgpaRegex);
    if (cgpaMatch && cgpaMatch[1]) {
        min_cgpa = parseFloat(cgpaMatch[1]);
    } else {
        // Fallback: search for pattern like "7.5 CGPA"
        const cgpaFallback = /([0-9]\.[0-9]{1,2})\s*(?:cgpa|gpa)/i;
        const fallbackMatch = cleanText.match(cgpaFallback);
        if (fallbackMatch && fallbackMatch[1]) {
            min_cgpa = parseFloat(fallbackMatch[1]);
        }
    }

    // 3. EXTRACT STIPEND
    let stipend_amount = 'Unspecified';
    const stipendRegex = /(?:stipend|salary|package|pay|ctc)[\s:=-]*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:k|\s*k|\s*\/\s*(?:month|mo|pm))?)/i;
    const stipendMatch = cleanText.match(stipendRegex);
    if (stipendMatch && stipendMatch[1]) {
        stipend_amount = stipendMatch[1].trim();
        if (!stipend_amount.toLowerCase().includes('month') && !stipend_amount.toLowerCase().includes('pm')) {
            stipend_amount += ' / month';
        }
    } else if (/\b([0-9]{1,2})k\b/i.test(cleanText)) {
        const kMatch = cleanText.match(/\b([0-9]{1,2})k\b/i);
        stipend_amount = `₹${kMatch[1]},000 / month`;
    }

    // 4. EXTRACT ELIGIBLE BRANCHES
    const branches = [];
    const branchKeywords = ['CSE', 'IT', 'ECE', 'EE', 'MECH', 'CIVIL', 'BCA', 'MCA'];
    for (const b of branchKeywords) {
        const regex = new RegExp(`\\b${b}\\b`, 'i');
        if (regex.test(cleanText)) {
            branches.push(b);
        }
    }
    const eligible_branches = branches.length > 0 ? branches.join(',') : 'ALL';

    // 5. EXTRACT WORK MODE & LOCATION
    let work_mode = 'ON_SITE';
    if (/\bremote\b|\bwork from home\b|\bwfh\b|\bvirtual\b/i.test(cleanText)) {
        work_mode = 'REMOTE';
    } else if (/\bhybrid\b/i.test(cleanText)) {
        work_mode = 'HYBRID';
    }

    let location = 'Remote';
    const locationMatch = cleanText.match(/(?:location|city|job location)[\s:=-]*([A-Za-z\s,]+)(?:\n|$)/i);
    if (locationMatch && locationMatch[1]) {
        location = locationMatch[1].trim();
    } else if (work_mode !== 'REMOTE') {
        location = 'On-Campus / Facility';
    }

    // 6. EXTRACT COMPANY NAME & ROLE DESIGNATION
    let company_name = 'Campus Opportunity';
    let title = 'Internship Trainee';

    // Heuristics for common formats:
    // e.g. "TCS is hiring Software Engineer Interns"
    // e.g. "Company: Infosys"
    const companyMatch = cleanText.match(/(?:company|firm|org)[\s:=-]*([A-Za-z0-9\s&.-]+?)(?:\n|,|$)/i);
    if (companyMatch && companyMatch[1] && companyMatch[1].trim().length > 1) {
        company_name = companyMatch[1].trim();
    } else {
        const hiringMatch = cleanText.match(/([A-Za-z0-9&.-]+)\s+(?:is hiring|recruitment|drive|is conducting|announces)/i);
        if (hiringMatch && hiringMatch[1]) {
            company_name = hiringMatch[1].trim();
        }
    }

    const titleMatch = cleanText.match(/(?:role|designation|position|profile|title)[\s:=-]*([A-Za-z0-9\s&.-]+?)(?:\n|,|$)/i);
    if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 2) {
        title = titleMatch[1].trim();
    } else {
        const rolePatterns = [
            /Full[\s-]?Stack\s+(?:Developer|Intern|Engineer)/i,
            /Software\s+(?:Developer|Engineer|Intern)/i,
            /SDE[\s-]?(?:Intern|Trainee|I)?/i,
            /Backend\s+(?:Developer|Engineer|Intern)/i,
            /Frontend\s+(?:Developer|Engineer|Intern)/i,
            /Data\s+(?:Analyst|Scientist|Engineer)\s*Intern/i,
            /Embedded\s+(?:Systems|Firmware|Hardware)\s*Intern/i,
            /AI\s*\/\s*ML\s*Intern/i
        ];
        for (const pattern of rolePatterns) {
            const m = cleanText.match(pattern);
            if (m) {
                title = m[0].trim();
                break;
            }
        }
    }

    // 7. EXTRACT DEADLINE
    let deadline = null;
    const deadlineMatch = cleanText.match(/(?:deadline|apply (?:before|by|till)|last date)[\s:=-]*([0-9]{1,2}(?:st|nd|rd|th)?[\s/-]+[A-Za-z0-9]+[\s/-]+[0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (deadlineMatch && deadlineMatch[1]) {
        const parsedDate = new Date(deadlineMatch[1].trim());
        if (!isNaN(parsedDate.getTime())) {
            deadline = parsedDate.toISOString().slice(0, 19).replace('T', ' ');
        }
    }

    return {
        title,
        company_name,
        stipend_amount,
        min_cgpa,
        eligible_branches,
        work_mode,
        location,
        apply_url,
        deadline,
        raw_snippet: cleanText
    };
}

module.exports = {
    parseWhatsAppMessage
};
