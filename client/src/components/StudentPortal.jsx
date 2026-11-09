import React, { useState, useEffect } from 'react';
import { 
  Briefcase, CheckCircle, Clock, Search, Upload, AlertCircle, 
  ChevronRight, ExternalLink, Sparkles, Filter, Award, BookOpen, Check, FileText
} from 'lucide-react';

export default function StudentPortal({ user, token }) {
  const [feed, setFeed] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
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

  // Robust Resume PDF Upload Handler
  const processResumeFile = async (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Please select a valid PDF document (.pdf).');
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
          text: data.message
        });
        loadData(); // Refresh skills and feed rankings
      } else {
        setResumeMessage({ type: 'error', text: data.message || 'Error processing resume.' });
      }
    } catch (err) {
      setResumeMessage({ type: 'error', text: 'Error uploading resume: ' + err.message });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processResumeFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processResumeFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
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
        setFeed(prev => prev.map(item => item.id === internshipId ? { ...item, has_applied: true } : item));
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
      {/* 1. STUDENT PROFILE & RESUME HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Enrolled Student
              </span>
              <span className="text-xs text-slate-500 font-mono">
                University Roll No: <strong className="text-slate-800">{studentProfile?.roll_number || user?.roll_number || '240111116'}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{user?.full_name}</h1>
            <p className="text-xs text-slate-600">
              Department of {studentProfile?.department || user?.department || 'Computer Science & Engineering'} • Graphic Era Hill University, Bhimtal
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
              <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Current CGPA</span>
              <span className="text-xl font-black text-slate-900">
                {studentProfile?.cgpa ? Number(studentProfile.cgpa).toFixed(2) : (user?.cgpa ? Number(user.cgpa).toFixed(2) : '8.50')}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
              <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Profile Skills</span>
              <span className="text-xl font-black text-blue-700">{skills.length}</span>
            </div>
          </div>
        </div>

        {/* 2. RESUME UPLOAD (ROBUST ACCESSIBLE DRAG & DROP) */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-5">
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Upload Resume (.PDF)
            </label>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition ${dragActive ? 'border-blue-600 bg-blue-50/60' : 'border-slate-300 bg-slate-50/60 hover:border-blue-500'}`}
            >
              <input 
                id="resume-upload-input"
                type="file" 
                accept=".pdf,application/pdf"
                className="sr-only" 
                onChange={handleFileChange}
                disabled={uploadingResume} 
              />
              <label htmlFor="resume-upload-input" className="cursor-pointer block">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  {uploadingResume ? 'Parsing Resume with College Matcher...' : 'Click to Browse or Drag PDF Here'}
                </div>
                <div className="text-3xs text-slate-500 mt-0.5">
                  Standard PDF format (extracts technical skills & CGPA automatically)
                </div>
              </label>
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Your Technical & Placement Skills ({skills.length})
                </label>
                <form onSubmit={handleAddSkill} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Add skill (e.g. Docker, Python)..."
                    value={newSkillName}
                    onChange={e => setNewSkillName(e.target.value)}
                    className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none bg-white"
                  />
                  <button type="submit" className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold transition">
                    + Add
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {skills.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs">
                    {s.skill_name}
                    <button 
                      onClick={() => handleRemoveSkill(s.id)}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-1 text-sm"
                      title="Remove skill"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {skills.length === 0 && (
                  <span className="text-xs text-slate-400 italic py-2">No skills tagged yet. Upload your PDF resume or add skills manually above.</span>
                )}
              </div>
            </div>

            {resumeMessage && (
              <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${resumeMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{resumeMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SEARCH & ELIGIBILITY CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by company, role, or skill..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-600 bg-slate-50 focus:bg-white"
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
            Show Only Eligible Opportunities
          </label>
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredFeed.length}</strong> Opportunities
          </span>
        </div>
      </div>

      {/* 4. CLEAN PLACEMENT OPPORTUNITY CARDS */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 text-center text-slate-500 rounded-2xl border border-slate-200">
            <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm font-medium">Matching opportunities to your academic profile...</p>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-500 rounded-2xl border border-slate-200">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-slate-700">No active placement opportunities found</h3>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search query or clearing filters.</p>
          </div>
        ) : (
          filteredFeed.map((job) => (
            <div 
              key={job.id} 
              className={`bg-white rounded-2xl border transition duration-200 shadow-xs hover:shadow-md p-5 ${job.is_eligible ? 'border-slate-200 hover:border-blue-400' : 'border-amber-200 bg-amber-50/20'}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left Side: Job Title & Meta */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                      {job.company_name}
                    </span>

                    {/* Source Attribution Badge */}
                    {job.source === 'LINKEDIN_PUBLIC' ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                        ⚡ Curated by Krishan Kumar (LinkedIn)
                      </span>
                    ) : job.source === 'FACULTY_WHATSAPP' ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Campus Faculty Circular
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {job.source}
                      </span>
                    )}

                    {/* Clean Featured / Recommended Tag */}
                    {job.is_featured && (
                      <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        Recommended Drive
                      </span>
                    )}

                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {job.work_mode} • {job.location || 'Remote'}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">{job.title}</h2>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{job.description}</p>

                  {/* Skills Match Section */}
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-slate-700">Skills Matching:</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${job.skill_match_percentage >= 70 ? 'bg-emerald-100 text-emerald-800' : job.skill_match_percentage >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                        {job.skill_match_percentage}% Skill Overlap
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {job.required_skills?.map((sk, i) => {
                        const isMatched = job.matched_skills?.includes(sk);
                        return (
                          <span 
                            key={i} 
                            className={`text-xs px-2.5 py-0.5 rounded font-medium border ${isMatched ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                          >
                            {isMatched ? '✓ ' : ''}{sk}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Side: Stipend, Eligibility & Apply Button */}
                <div className="lg:w-72 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5 space-y-3">
                  <div>
                    <div className="text-3xs text-slate-500 uppercase tracking-wider font-semibold">Stipend / Package</div>
                    <div className="text-base font-black text-slate-900">{job.stipend_amount || 'Competitive'}</div>
                    <div className="text-3xs text-slate-500 mt-0.5">Min Cutoff: {Number(job.min_cgpa).toFixed(1)} CGPA</div>
                  </div>

                  {/* Eligibility Checklist */}
                  {!job.is_eligible ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-3xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1 text-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Academic Criteria:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                        {job.eligibility_warnings?.map((w, wi) => (
                          <li key={wi}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Eligible for this drive</span>
                    </div>
                  )}

                  {/* Apply Action Button */}
                  {job.has_applied ? (
                    <button 
                      disabled
                      className="w-full py-2.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-default border border-emerald-300"
                    >
                      <Check className="w-4 h-4" />
                      Applied on Portal
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApply(job.id, job.apply_url)}
                      className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
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
