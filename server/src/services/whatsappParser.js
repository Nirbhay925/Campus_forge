const url = require('url');

/**
 * ==============================================================================
 * CAMPUSFORGE: ADVANCED WHATSAPP CIRCULAR HEURISTIC PARSER
 * ==============================================================================
 * Handles messy, informal WhatsApp posts from faculty coordinators, including:
 * 1. Fully-detailed circulars (e.g., Company, Role, CGPA, Stipend, Deadline)
 * 2. Multi-link broadcasts (e.g., WhatsApp digest with 3-5 career links in one message)
 * 3. Zero-detail raw links (e.g. "VISA – Intern \n https://..." with no CGPA or deadline)
 * 
 * Intelligent Features:
 * - Multi-opportunity block segmenting
 * - Unicode dash delimiter recognition (-, –, —, |, :, /)
 * - Domain & URL slug heuristic extraction (Workday, Stripe, Google, etc.)
 * - Automatic skill inference mapped to standard college skills
 * - Sensible zero-detail fallbacks (CGPA 0.0, branches, 14-day deadline)
 */

const DOMAIN_COMPANY_MAP = {
    'visa': 'Visa',
    'stripe': 'Stripe',
    'google': 'Google',
    'microsoft': 'Microsoft',
    'amazon': 'Amazon',
    'apple': 'Apple',
    'netflix': 'Netflix',
    'meta': 'Meta',
    'uber': 'Uber',
    'adobe': 'Adobe',
    'tcs': 'TCS',
    'infosys': 'Infosys',
    'wipro': 'Wipro',
    'accenture': 'Accenture',
    'cognizant': 'Cognizant',
    'deloitte': 'Deloitte',
    'capgemini': 'Capgemini',
    'unstop': 'Unstop',
    'linkedin': 'LinkedIn',
    'internshala': 'Internshala',
    'wellfound': 'Wellfound'
};

function cleanTitleString(str) {
    if (!str) return '';
    return str
        .replace(/[*_~`]/g, '')
        .replace(/\b(REF|REQ|JOB)[\w-]+\b/gi, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function inferCompanyFromUrl(link) {
    try {
        const parsed = new url.URL(link);
        const hostParts = parsed.hostname.split('.');
        for (const part of hostParts) {
            const lower = part.toLowerCase();
            if (DOMAIN_COMPANY_MAP[lower]) {
                return DOMAIN_COMPANY_MAP[lower];
            }
        }
        if (parsed.hostname.includes('myworkdayjobs.com')) {
            const sub = hostParts[0].toLowerCase();
            return DOMAIN_COMPANY_MAP[sub] || sub.toUpperCase();
        }
        const domainRoot = hostParts.length > 2 ? hostParts[hostParts.length - 2] : hostParts[0];
        return domainRoot.charAt(0).toUpperCase() + domainRoot.slice(1);
    } catch {
        return 'Campus Partner';
    }
}

function inferRoleFromUrl(link) {
    try {
        const parsed = new url.URL(link);
        const segments = parsed.pathname.split('/').filter(Boolean);
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i].toLowerCase();
            if (/^\d+$/.test(seg) || seg === 'job' || seg === 'listing' || seg === 'jobs' || seg === 'results') continue;
            let cleaned = seg.replace(/^[0-9]+-/, '').replace(/[-_]+/g, ' ');
            cleaned = cleaned.replace(/\b(ref|req)\w+\b/gi, '').trim();
            if (cleaned.length > 3) {
                return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
        }
    } catch {}
    return 'Software Engineer Intern';
}

function inferSkillsFromTextAndRole(roleTitle, fullSnippet) {
    const combined = `${roleTitle} ${fullSnippet}`.toLowerCase();
    const skills = new Set();

    if (combined.includes('software') || combined.includes('sde') || combined.includes('engineer') || combined.includes('developer')) {
        skills.add('Data Structures');
        skills.add('Java');
        skills.add('Python');
        skills.add('Git');
    }
    if (combined.includes('intern') || combined.includes('trainee')) {
        skills.add('Problem Solving');
        skills.add('Python');
    }
    if (combined.includes('payment') || combined.includes('fintech') || combined.includes('backend') || combined.includes('api')) {
        skills.add('SQL');
        skills.add('REST APIs');
        skills.add('PostgreSQL');
    }
    if (combined.includes('frontend') || combined.includes('web') || combined.includes('react') || combined.includes('ui')) {
        skills.add('React');
        skills.add('JavaScript');
        skills.add('HTML5');
    }
    if (combined.includes('data') || combined.includes('analyst') || combined.includes('ml') || combined.includes('ai')) {
        skills.add('Python');
        skills.add('Pandas');
        skills.add('Machine Learning');
    }
    if (combined.includes('cloud') || combined.includes('devops') || combined.includes('aws')) {
        skills.add('AWS');
        skills.add('Docker');
    }
    if (combined.includes('embedded') || combined.includes('hardware') || combined.includes('iot')) {
        skills.add('Embedded Systems');
        skills.add('C++');
        skills.add('IoT');
    }

    if (skills.size === 0) {
        skills.add('Python');
        skills.add('SQL');
        skills.add('Git');
    }

    return Array.from(skills).slice(0, 5);
}

function parseSingleOpportunity(textSnippet, targetUrl) {
    const cleanText = textSnippet.replace(/\r\n/g, '\n').trim();

    // 1. URL
    let apply_url = targetUrl || '';
    if (!apply_url) {
        const urlMatch = cleanText.match(/(https?:\/\/[^\s"'<>]+)/i);
        apply_url = urlMatch ? urlMatch[1] : '';
    }

    // 2. Minimum CGPA
    let min_cgpa = 0.0;
    const cgpaRegex = /(?:min(?:imum)?[\s_-]*cgpa|cgpa[\s:=-]*cutoff|cutoff|cgpa)[\s:=-]*([0-9]\.[0-9]{1,2})/i;
    const cgpaMatch = cleanText.match(cgpaRegex);
    if (cgpaMatch && cgpaMatch[1]) {
        min_cgpa = parseFloat(cgpaMatch[1]);
    } else {
        const cgpaFallback = /([0-9]\.[0-9]{1,2})\s*(?:cgpa|gpa)/i;
        const fallbackMatch = cleanText.match(cgpaFallback);
        if (fallbackMatch && fallbackMatch[1]) {
            min_cgpa = parseFloat(fallbackMatch[1]);
        }
    }

    // 3. Stipend
    let stipend_amount = 'Competitive / Industry Standard';
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

    // 4. Eligible Branches
    const branches = [];
    const branchKeywords = ['CSE', 'IT', 'ECE', 'EE', 'MECH', 'CIVIL', 'BCA', 'MCA'];
    for (const b of branchKeywords) {
        const regex = new RegExp(`\\b${b}\\b`, 'i');
        if (regex.test(cleanText)) {
            branches.push(b);
        }
    }
    let eligible_branches = branches.length > 0 ? branches.join(',') : 'CSE,IT,ECE';

    // 5. Work Mode & Location
    let work_mode = 'ON_SITE';
    if (/\bremote\b|\bwork from home\b|\bwfh\b|\bvirtual\b/i.test(cleanText) || apply_url.toLowerCase().includes('remote')) {
        work_mode = 'REMOTE';
    } else if (/\bhybrid\b/i.test(cleanText)) {
        work_mode = 'HYBRID';
    }

    let location = work_mode === 'REMOTE' ? 'Remote' : 'Off-Campus / Multiple Locations';
    const locationMatch = cleanText.match(/(?:location|city|job location)[\s:=-]*([A-Za-z\s,]+)(?:\n|$)/i);
    if (locationMatch && locationMatch[1]) {
        location = locationMatch[1].trim();
    }

    // 6. Company & Role
    let company_name = '';
    let title = '';

    const RESERVED_KEYWORDS = [
        'stipend', 'salary', 'package', 'ctc', 'pay',
        'deadline', 'last date', 'apply by',
        'eligibility', 'eligible', 'criteria', 'cutoff', 'cgpa', 'gpa',
        'branches', 'branch', 'department',
        'location', 'venue', 'mode',
        'company', 'firm', 'organization',
        'role', 'profile', 'designation', 'position', 'title',
        'requirements', 'skills', 'prerequisites',
        'link', 'apply link', 'url', 'registration',
        'about us', 'note', 'batch', 'campus'
    ];

    // Priority 1: Check for explicit "Company: ..."
    const companyMatch = cleanText.match(/(?:company|firm|org)[\s:=-]*([A-Za-z0-9\s&.-]+?)(?:\n|,|$)/i);
    if (companyMatch && companyMatch[1] && companyMatch[1].trim().length > 1) {
        company_name = cleanTitleString(companyMatch[1]);
    }

    // Priority 2: Check for explicit "Role: ..."
    const titleMatch = cleanText.match(/(?:role|designation|position|profile|title)[\s:=-]*([A-Za-z0-9\s&.-]+?)(?:\n|,|$)/i);
    if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 2) {
        title = cleanTitleString(titleMatch[1]);
    }

    // Priority 3: Check line headers with delimiter: e.g. "VISA – Intern" or "Stripe – Software Engineer, Intern" or "Google - Software Engineer, Payments"
    if (!company_name || !title) {
        const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
        const delimiterRegex = /[\u2013\u2014\-|/]/;
        for (const line of lines) {
            if (line.includes('http') || line.toLowerCase().startsWith('about us')) continue;
            if (delimiterRegex.test(line)) {
                const parts = line.split(delimiterRegex);
                if (parts.length >= 2) {
                    const cPart = cleanTitleString(parts[0]);
                    const rPart = cleanTitleString(parts.slice(1).join(' - '));

                    const isReservedC = RESERVED_KEYWORDS.some(kw => cPart.toLowerCase().startsWith(kw));
                    const isReservedR = RESERVED_KEYWORDS.some(kw => rPart.toLowerCase().startsWith(kw));

                    if (!isReservedC && !company_name && cPart.length >= 2 && cPart.length <= 40) {
                        company_name = cPart;
                    }
                    if (!isReservedR && !title && rPart.length >= 2) {
                        title = rPart;
                    }
                }
            }
        }
    }

    // Priority 4: Fallback role regex patterns if title still missing
    if (!title) {
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
                title = cleanTitleString(m[0]);
                break;
            }
        }
    }

    // Fallback company heuristics
    if (!company_name) {
        const hiringMatch = cleanText.match(/([A-Za-z0-9&.-]+)\s+(?:is hiring|recruitment|drive|is conducting|announces)/i);
        if (hiringMatch && hiringMatch[1]) {
            company_name = cleanTitleString(hiringMatch[1]);
        } else if (apply_url) {
            company_name = inferCompanyFromUrl(apply_url);
        } else {
            company_name = 'Campus Partner';
        }
    }

    // Fallback role heuristics
    if (!title && apply_url) {
        title = inferRoleFromUrl(apply_url);
    }
    if (!title) {
        title = 'Internship Trainee';
    }

    // 7. Deadline (Explicit or default 14 days from today)
    let deadline = null;
    const deadlineMatch = cleanText.match(/(?:deadline|apply (?:before|by|till)|last date)[\s:=-]*([0-9]{1,2}(?:st|nd|rd|th)?[\s/-]+[A-Za-z0-9]+[\s/-]+[0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (deadlineMatch && deadlineMatch[1]) {
        const parsedDate = new Date(deadlineMatch[1].trim());
        if (!isNaN(parsedDate.getTime())) {
            deadline = parsedDate.toISOString().slice(0, 19).replace('T', ' ');
        }
    }
    if (!deadline) {
        deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    }

    // 8. Description
    let description = '';
    const previewMatch = cleanText.match(/About Us ([^\n]+)/i);
    if (previewMatch && company_name.toLowerCase().includes('visa')) {
        description = previewMatch[0];
    } else {
        description = `Off-campus opportunity shared by faculty for ${company_name} - ${title}. Eligible students are encouraged to apply directly via the portal link.`;
    }

    const required_skills = inferSkillsFromTextAndRole(title, cleanText);

    return {
        title: title || 'Intern',
        company_name: company_name || 'Hiring Organization',
        stipend_amount,
        min_cgpa,
        eligible_branches,
        work_mode,
        location,
        apply_url,
        deadline,
        description,
        required_skills,
        raw_snippet: cleanText,
        source: 'FACULTY_WHATSAPP'
    };
}

/**
 * Main parser entry point.
 * Supports single message or batch multi-link messages.
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
            description: '',
            required_skills: [],
            isBatch: false,
            count: 0,
            opportunities: []
        };
    }

    const cleanText = rawText.replace(/\r\n/g, '\n').trim();

    // 1. Detect all HTTP/HTTPS links
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    const urlMatches = Array.from(cleanText.matchAll(urlRegex));

    if (urlMatches.length <= 1) {
        // Single link or plain text circular
        const targetUrl = urlMatches.length === 1 ? urlMatches[0][0] : '';
        const single = parseSingleOpportunity(cleanText, targetUrl);
        return {
            ...single,
            isBatch: false,
            count: 1,
            opportunities: [single]
        };
    }

    // 2. Multi-link batch circular
    const opportunities = [];

    urlMatches.forEach((match, index) => {
        const link = match[0];
        const matchIndex = match.index;
        // Start from either the previous match end, or start of text
        const prevEnd = index > 0 ? (urlMatches[index - 1].index + urlMatches[index - 1][0].length) : 0;
        const localSnippet = cleanText.substring(prevEnd, matchIndex + link.length);
        const parsed = parseSingleOpportunity(localSnippet, link);

        // If the message has an "About Us" or intro at top belonging to the first item (e.g. Visa preview)
        if (index === 0) {
            const previewMatch = cleanText.match(/About Us ([^\n]+)/i);
            if (previewMatch) {
                parsed.description = previewMatch[0];
            }
        }

        opportunities.push(parsed);
    });

    const primary = opportunities[0];

    return {
        ...primary,
        isBatch: opportunities.length > 1,
        count: opportunities.length,
        opportunities: opportunities
    };
}

module.exports = {
    parseWhatsAppMessage,
    parseSingleOpportunity
};
