import React, { useState, useEffect } from 'react';
import { 
  Briefcase, CheckCircle, Clock, Search, Upload, AlertCircle, 
  ChevronRight, ExternalLink, Sparkles, Filter, Award, BookOpen, Check
} from 'lucide-react';

export default function StudentPortal({ user, token }) {
  const [feed, setFeed] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState(null);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEligibleOnly, setFilterEligibleOnly] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');

  // Fetch student feed & skills
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Feed
      const feedRes = await fetch('/api/students/feed', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const feedData = await feedRes.json();
      if (feedData.success) {
        setFeed(feedData.feed);
        setStudentProfile(feedData.studentProfile);
      }

      // 2. Fetch Skills
      const skillsRes = await fetch('/api/students/skills', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const skillsData = await skillsRes.json();
      if (skillsData.success) {
        setSkills(skillsData.skills);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle Resume PDF Upload
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      alert('Please upload a PDF format resume.');
      return;
    }

    setUploadingResume(true);
    setResumeMessage(null);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/students/resume', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setResumeMessage({
          type: 'success',
          text: `Resume parsed! Extracted ${data.totalSkillsFound} skills with detected CGPA: ${data.detectedCGPA || 'Confirmed'}.`
        });
        loadData(); // Refresh skills and feed rankings
      } else {
        setResumeMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setResumeMessage({ type: 'error', text: 'Error uploading resume: ' + err.message });
    } finally {
      setUploadingResume(false);
    }
  };

  // Handle Manual Skill Add
  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    try {
      const res = await fetch('/api/students/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skill_name: newSkillName.trim(), proficiency_level: 'INTERMEDIATE' })
      });
      const data = await res.json();
      if (data.success) {
        setNewSkillName('');
        loadData();
      }
    } catch (err) {
      console.error('Error adding skill:', err);
    }
  };

  // Handle Skill Remove
  const handleRemoveSkill = async (skillId) => {
    try {
      const res = await fetch(`/api/students/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error('Error deleting skill:', err);
    }
  };

  // Handle Apply Action
  const handleApply = async (internshipId, applyUrl) => {
    try {
      const res = await fetch(`/api/students/apply/${internshipId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Update local state to show applied
        setFeed(prev => prev.map(item => item.id === internshipId ? { ...item, has_applied: true } : item));
        // Open company portal in new tab
        window.open(applyUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Error recording application:', err);
    }
  };

  // Filter feed
  const filteredFeed = feed.filter(job => {
    const matchesSearch = 
      job.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.required_skills && job.required_skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    
    if (filterEligibleOnly && !job.is_eligible) return false;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. STUDENT PROFILE HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Student Profile
              </span>
              <span className="text-xs text-slate-500 font-mono">Roll: {studentProfile?.roll_number || 'GEHU-2026'}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{user?.full_name}</h1>
            <p className="text-sm text-slate-600">
              Department of {studentProfile?.department || 'Computer Science & Engineering'} • Graphic Era Hill University, Bhimtal
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-medium">Verified CGPA</span>
              <span className="text-lg font-bold text-slate-800">{studentProfile?.cgpa ? Number(studentProfile.cgpa).toFixed(2) : '8.50'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-medium">Extracted Skills</span>
              <span className="text-lg font-bold text-blue-700">{skills.length}</span>
            </div>
          </div>
        </div>

        {/* 2. RESUME UPLOAD & SKILLS BAR */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Resume Intelligence Parser (.PDF)
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition">
              <Upload className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-slate-700">
                {uploadingResume ? 'Parsing PDF...' : 'Upload Updated Resume (PDF)'}
              </span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={uploadingResume} />
            </label>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Verified Skill Tags ({skills.length})
              </label>
              <form onSubmit={handleAddSkill} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Add skill (e.g. Docker)..."
                  value={newSkillName}
                  onChange={e => setNewSkillName(e.target.value)}
                  className="text-xs px-2.5 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button type="submit" className="text-xs px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 font-medium">
                  + Add
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
              {skills.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs">
                  {s.skill_name}
                  <button 
                    onClick={() => handleRemoveSkill(s.id)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-0.5"
                    title="Remove skill"
                  >
                    ×
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <span className="text-xs text-slate-400 italic py-1">No skills detected yet. Upload your PDF resume to auto-extract.</span>
              )}
            </div>
          </div>
        </div>

        {resumeMessage && (
          <div className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${resumeMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{resumeMessage.text}</span>
          </div>
        )}
      </div>

      {/* 3. OPPORTUNITIES FEED & CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by company, role, or skill..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterEligibleOnly}
              onChange={e => setFilterEligibleOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            Show Only Eligible for Me
          </label>
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredFeed.length}</strong> Opportunities
          </span>
        </div>
      </div>

      {/* 4. OPPORTUNITY CARDS (SORTED BY OS MATCH + AGING SCORE) */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
            <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm font-medium">Running OS matching algorithms & dynamic aging calculations...</p>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-slate-700">No matching campus opportunities</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          filteredFeed.map((job, idx) => (
            <div 
              key={job.id} 
              className={`bg-white rounded-xl border transition duration-200 shadow-2xs hover:shadow-md p-5 ${job.is_eligible ? 'border-slate-200 hover:border-blue-300' : 'border-amber-200/70 bg-amber-50/10'}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left side: Job Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {job.company_name}
                    </span>

                    {/* Source Attribution Badge */}
                    {job.source === 'LINKEDIN_PUBLIC' ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                        ⚡ Curated by Krishan Kumar (LinkedIn)
                      </span>
                    ) : job.source === 'FACULTY_WHATSAPP' ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Campus Faculty Drive
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {job.source}
                      </span>
                    )}

                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {job.work_mode} • {job.location || 'Remote'}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                  <p className="text-xs text-slate-600 line-clamp-2">{job.description}</p>

                  {/* Skills match section */}
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-slate-600">Required Skills:</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${job.skill_match_percentage >= 70 ? 'bg-emerald-100 text-emerald-800' : job.skill_match_percentage >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {job.skill_match_percentage}% Skill Overlap
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {job.required_skills?.map((sk, i) => {
                        const isMatched = job.matched_skills?.includes(sk);
                        return (
                          <span 
                            key={i} 
                            className={`text-xs px-2 py-0.5 rounded font-medium border ${isMatched ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                          >
                            {isMatched ? '✓ ' : ''}{sk}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right side: Telemetry & Actions */}
                <div className="lg:w-72 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5 space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Stipend / Package</div>
                    <div className="text-base font-bold text-slate-900">{job.stipend_amount || 'Competitive'}</div>
                    <div className="text-xs text-slate-500 mt-1">Min Cutoff: {Number(job.min_cgpa).toFixed(1)} CGPA</div>
                  </div>

                  {/* OS Telemetry Badge */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>OS Final Score:</span>
                      <strong className="text-slate-900 font-bold">{job.composite_ranking_score}</strong>
                    </div>
                    {Number(job.aging_boost_score) > 0 && (
                      <div className="flex items-center justify-between text-amber-700">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Aging Rescue Boost:
                        </span>
                        <strong className="font-semibold">+{Number(job.aging_boost_score).toFixed(1)} pts</strong>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-500 text-3xs">
                      <span>MLFQ Level: Queue {job.current_queue}</span>
                      <span>Clicks: {job.apply_clicks}</span>
                    </div>
                  </div>

                  {/* Eligibility Warning or Check */}
                  {!job.is_eligible ? (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-3xs text-amber-800">
                      <div className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                        Eligibility Criteria:
                      </div>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        {job.eligibility_warnings?.map((w, wi) => (
                          <li key={wi}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-3xs text-emerald-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      You meet all academic eligibility criteria!
                    </div>
                  )}

                  {/* Action Button */}
                  {job.has_applied ? (
                    <button 
                      disabled
                      className="w-full py-2 bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-default"
                    >
                      <Check className="w-4 h-4" />
                      Applied via Portal
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApply(job.id, job.apply_url)}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      Apply on Portal
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
