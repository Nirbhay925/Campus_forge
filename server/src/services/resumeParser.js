const pdfParse = require('pdf-parse');

/**
 * CONCEPT EXPLANATION: Binary Stream PDF Extraction & Skill Matching
 * -------------------------------------------------------------------
 * This service takes the raw buffer of an uploaded PDF, converts it to
 * text in memory, and performs algorithmic matching against our canonical
 * skills dictionary stored in MySQL.
 */

/**
 * 1. Convert binary PDF buffer into clean plaintext
 */
async function extractTextFromPDF(buffer) {
    try {
        const data = await pdfParse(buffer);
        // Clean up excessive whitespace and newline characters
        const cleanedText = data.text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
        return cleanedText;
    } catch (error) {
        console.error('Error parsing PDF buffer:', error);
        throw new Error('Failed to extract text from PDF resume: ' + error.message);
    }
}

/**
 * 2. Algorithmic Skill Extractor with Regex Word Boundaries
 * 
 * WHY WORD BOUNDARIES (\b)?
 * If a resume mentions "JavaScript", a naive search for "Java" would falsely
 * award the student a Java skill. By using `\bJava\b`, we ensure exact
 * token matching. Special symbols like `C++` and `Node.js` are escaped properly.
 */
function extractSkillsFromText(resumeText, masterSkillsList) {
    if (!resumeText || !masterSkillsList || !Array.isArray(masterSkillsList)) {
        return [];
    }

    const matchedSkills = [];
    const lowerResume = resumeText.toLowerCase();

    for (const skill of masterSkillsList) {
        const skillName = skill.skill_name.trim();

        // Escape regex characters (e.g. C++, Node.js, .NET)
        const escaped = skillName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // Build word boundary pattern (case-insensitive)
        let pattern;
        if (skillName.endsWith('++')) {
            // C++ doesn't have a word boundary after '+'
            pattern = new RegExp(`\\b${escaped}`, 'i');
        } else {
            pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        }

        if (pattern.test(lowerResume)) {
            matchedSkills.push({
                id: skill.id,
                skill_name: skill.skill_name,
                category: skill.category
            });
        }
    }

    return matchedSkills;
}

/**
 * 3. CGPA Heuristic Pattern Detector
 * Looks for standard academic resume patterns such as:
 * - "CGPA: 8.5" or "CGPA - 8.5"
 * - "8.5 / 10" or "8.5/10"
 * - "GPA: 8.4"
 */
function detectCGPAFromText(resumeText) {
    if (!resumeText) return null;

    // Pattern 1: e.g. "CGPA: 8.45" or "CGPA - 8.4" or "GPA 8.2"
    const cgpaRegex = /(?:CGPA|GPA|SGPA)[\s:=-]*([0-9]\.[0-9]{1,2})/i;
    const match1 = resumeText.match(cgpaRegex);
    if (match1 && match1[1]) {
        const val = parseFloat(match1[1]);
        if (val >= 0.0 && val <= 10.0) return val;
    }

    // Pattern 2: e.g. "8.45/10" or "8.5 / 10"
    const slashRegex = /([0-9]\.[0-9]{1,2})\s*\/\s*10(?:\.0)?/i;
    const match2 = resumeText.match(slashRegex);
    if (match2 && match2[1]) {
        const val = parseFloat(match2[1]);
        if (val >= 0.0 && val <= 10.0) return val;
    }

    return null;
}

module.exports = {
    extractTextFromPDF,
    extractSkillsFromText,
    detectCGPAFromText
};
