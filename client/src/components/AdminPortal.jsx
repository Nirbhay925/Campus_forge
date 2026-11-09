import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Check, X, RefreshCw, Sparkles, AlertTriangle, 
  ExternalLink, Send, Filter, Trash2, Calendar, Users, Eye, Info, CheckCircle2
} from 'lucide-react';

export default function AdminPortal({ user, token }) {
  const [activeTab, setActiveTab] = useState('moderation'); // 'moderation' | 'active_drives' | 'linkedin' | 'priority_system'
  
  // Moderation state
  const [pendingQueue, setPendingQueue] = useState([]);
  const [loadingMod, setLoadingMod] = useState(true);

  // Active drives state
  const [activeDrives, setActiveDrives] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // LinkedIn Krishan Kumar state
  const [linkedInKeyword, setLinkedInKeyword] = useState('internship');
  const [rawLinkedInPost, setRawLinkedInPost] = useState('');
  const [syncingLinkedIn, setSyncingLinkedIn] = useState(false);
  const [linkedInSyncResult, setLinkedInSyncResult] = useState(null);

  // Priority Engine state
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [optimizingPriority, setOptimizingPriority] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);

  // Load Pending Moderation Queue
  const loadModerationQueue = async () => {
    setLoadingMod(true);
    try {
      const res = await fetch('/api/admin/moderation', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingQueue(data.opportunities || []);
      }
    } catch (err) {
      console.error('Error fetching moderation queue:', err);
    } finally {
      setLoadingMod(false);
    }
  };

  // Load Active Listed Drives
  const loadActiveDrives = async () => {
    setLoadingActive(true);
    try {
      const res = await fetch('/api/admin/active-drives', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveDrives(data.drives || []);
      }
    } catch (err) {
      console.error('Error fetching active drives:', err);
    } finally {
      setLoadingActive(false);
    }
  };

  // Load Priority Telemetry
  const loadTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await fetch('/api/admin/os-telemetry', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTelemetry(data.telemetry);
      }
    } catch (err) {
      console.error('Error loading telemetry:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadModerationQueue();
    loadActiveDrives();
    loadTelemetry();
  }, [token]);

  // Handle 1-Click Verification
  const handleVerify = async (id) => {
    try {
      const res = await fetch(`/api/admin/moderation/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingQueue(prev => prev.filter(item => item.id !== id));
        loadActiveDrives();
        setActionMessage({ type: 'success', text: 'Drive successfully approved and published to student feeds!' });
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error verifying drive: ' + err.message);
    }
  };

  // Handle Rejection
  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to decline this circular?')) return;
    try {
      const res = await fetch(`/api/admin/moderation/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingQueue(prev => prev.filter(item => item.id !== id));
        setActionMessage({ type: 'info', text: 'Circular rejected and archived.' });
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error rejecting drive: ' + err.message);
    }
  };

  // Handle Removing an Active Drive
  const handleRemoveActive = async (id, companyName) => {
    if (!window.confirm(`Are you sure you want to remove ${companyName} from the student portal? Students will no longer see this listing.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/internships/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveDrives(prev => prev.filter(item => item.id !== id));
        setActionMessage({ type: 'success', text: `${companyName} has been removed from student feeds.` });
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error removing drive: ' + err.message);
    }
  };

  // Handle Krishan Kumar LinkedIn Sync
  const handleSyncLinkedIn = async () => {
    setSyncingLinkedIn(true);
    setLinkedInSyncResult(null);

    try {
      const res = await fetch('/api/admin/sync-linkedin-creator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keyword: linkedInKeyword,
          raw_text: rawLinkedInPost.trim() || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setLinkedInSyncResult(data.results);
        setRawLinkedInPost('');
        loadModerationQueue();
        loadActiveDrives();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error syncing LinkedIn feed: ' + err.message);
    } finally {
      setSyncingLinkedIn(false);
    }
  };

  // Handle Placement Priority Optimization
  const handleRunOptimization = async () => {
    setOptimizingPriority(true);
    setOptimizationResult(null);

    try {
      const res = await fetch('/api/admin/trigger-aging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          time_step_hours: 24,
          force_epoch_boost: true,
          starvation_threshold: 3
        })
      });
      const data = await res.json();
      if (data.success) {
        setOptimizationResult(data.cycleSummary);
        loadTelemetry();
        loadActiveDrives();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error running priority optimization: ' + err.message);
    } finally {
      setOptimizingPriority(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TPO INSTITUTIONAL HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Training & Placement Cell (TPO)
              </span>
              <span className="text-xs text-slate-500 font-medium">GEHU Bhimtal Campus</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{user?.full_name || 'TPO Placement Cell'}</h1>
            <p className="text-sm text-slate-600">
              Campus placement moderation desk, drive life-cycle management, and student opportunity distribution.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2 text-center">
              <span className="text-3xs text-amber-700 uppercase tracking-wider block font-semibold">Pending Review</span>
              <span className="text-lg font-bold text-amber-800">{pendingQueue.length}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2 text-center">
              <span className="text-3xs text-blue-700 uppercase tracking-wider block font-semibold">Live on Portal</span>
              <span className="text-lg font-bold text-blue-800">{activeDrives.length}</span>
            </div>
          </div>
        </div>

        {/* NOTIFICATION BANNER */}
        {actionMessage && (
          <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 mt-5 border-t border-slate-100 pt-3">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'moderation' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Pending Verification ({pendingQueue.length})
          </button>

          <button
            onClick={() => { setActiveTab('active_drives'); loadActiveDrives(); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'active_drives' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            Active Listed Drives ({activeDrives.length})
          </button>

          <button
            onClick={() => setActiveTab('linkedin')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'linkedin' 
                ? 'bg-sky-700 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ExternalLink className="w-4 h-4 text-sky-200" />
            Verified LinkedIn Stream
          </button>

          <button
            onClick={() => { setActiveTab('priority_system'); loadTelemetry(); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'priority_system' 
                ? 'bg-indigo-700 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Smart Recommendation Balancer
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PENDING VERIFICATION QUEUE */}
      {/* ============================================================== */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pending Faculty Circulars & Direct Listings ({pendingQueue.length})
              </h2>
              <p className="text-xs text-slate-500">
                Review incoming WhatsApp notices and external posts before publishing them to the student body.
              </p>
            </div>
            <button 
              onClick={loadModerationQueue}
              className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingMod ? (
            <div className="bg-white p-10 text-center text-slate-400 rounded-xl border border-slate-200">
              Loading pending circulars...
            </div>
          ) : pendingQueue.length === 0 ? (
            <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200 space-y-2">
              <Check className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">All Circulars Reviewed!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No circulars are currently awaiting moderation. New notices forwarded by faculty coordinators or imported from verified channels will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingQueue.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded">
                          {item.company_name}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{item.title}</h3>
                      </div>
                      <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {item.source === 'FACULTY_WHATSAPP' ? 'Faculty Notice' : item.source === 'LINKEDIN_PUBLIC' ? 'LinkedIn Stream' : 'Portal'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{item.description}</p>

                    <div className="bg-slate-50 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div><strong>Min CGPA:</strong> {Number(item.min_cgpa) > 0 ? Number(item.min_cgpa).toFixed(1) : 'No Cutoff (Open to all)'}</div>
                      <div><strong>Eligible Branches:</strong> {item.eligible_branches || 'All Engineering'}</div>
                      <div><strong>Stipend:</strong> {item.stipend_amount || 'Industry Standard'}</div>
                      <div><strong>Shared by:</strong> {item.posted_by_name || 'Placement Coordinator'}</div>
                    </div>

                    {item.required_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.required_skills.map((s, idx) => (
                          <span key={idx} className="text-3xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <a
                      href={item.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 font-medium"
                    >
                      Visit Official Portal <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg transition"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleVerify(item.id)}
                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        Approve & Publish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ACTIVE LISTED DRIVES & MANAGEMENT */}
      {/* ============================================================== */}
      {activeTab === 'active_drives' && (
        <div className="space-y-4">
          {/* TPO INSTRUCTIONS BANNER */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4.5 text-xs text-blue-900 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-950">
              <Info className="w-4 h-4 text-blue-700 shrink-0" />
              TPO Guide: Managing & Removing Live Campus Listings
            </div>
            <ul className="list-disc pl-5 space-y-1 text-blue-800 leading-relaxed text-xs">
              <li>
                <strong>Automatic Removal with Time:</strong> The portal automatically archives opportunities whose application deadline has passed. Expired drives are automatically filtered out from student feeds.
              </li>
              <li>
                <strong>Manual 1-Click Removal:</strong> If a company reaches its applicant capacity or closes registrations early, click the red <strong>"Remove from Portal"</strong> button on that card. It is immediately unpublished from all student accounts.
              </li>
              <li>
                <strong>Student Engagement:</strong> You can see real-time student view counts below each listing to gauge campus interest.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Currently Live on Student Portal ({activeDrives.length})
              </h2>
              <p className="text-xs text-slate-500">
                Verified opportunities visible to Graphic Era Hill University students.
              </p>
            </div>
            <button 
              onClick={loadActiveDrives}
              className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingActive ? (
            <div className="bg-white p-10 text-center text-slate-400 rounded-xl border border-slate-200">
              Loading active campus listings...
            </div>
          ) : activeDrives.length === 0 ? (
            <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200 space-y-2">
              <h3 className="text-base font-bold text-slate-800">No Active Drives Live</h3>
              <p className="text-xs text-slate-500">
                Approve pending notices in the Verification Queue or sync verified streams to publish drives.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDrives.map(drive => (
                <div key={drive.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded">
                          {drive.company_name}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{drive.title}</h3>
                      </div>
                      <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        Live on Portal
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{drive.description}</p>

                    <div className="bg-slate-50 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div><strong>Min CGPA:</strong> {Number(drive.min_cgpa) > 0 ? Number(drive.min_cgpa).toFixed(1) : 'Open to all'}</div>
                      <div><strong>Branches:</strong> {drive.eligible_branches || 'All Engineering'}</div>
                      <div><strong>Stipend:</strong> {drive.stipend_amount || 'Industry Standard'}</div>
                      <div>
                        <strong>Deadline:</strong> {drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Rolling Application'}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        {drive.total_impressions || 0} student views
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        {drive.apply_clicks || 0} applications started
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <a
                      href={drive.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 font-medium"
                    >
                      View Application Link <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleRemoveActive(drive.id, drive.company_name)}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 border border-rose-200 shadow-xs"
                      title="Immediately remove this drive from student feeds"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove from Portal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: VERIFIED KRISHAN KUMAR LINKEDIN STREAM */}
      {/* ============================================================== */}
      {activeTab === 'linkedin' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                Verified Creator Feed
              </span>
              <a 
                href="https://www.linkedin.com/in/krishan-kumar08" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-sky-700 hover:underline flex items-center gap-1 font-medium"
              >
                https://www.linkedin.com/in/krishan-kumar08 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1.5">Krishan Kumar Verified Internship Stream</h2>
            <p className="text-xs text-slate-600 mt-1">
              Synchronizes 100% authentic off-campus drives and internships shared by Krishan Kumar when matching the keyword <strong className="text-slate-900">"internship"</strong>. Ingests genuine tech openings (Red Hat, Salesforce, ShareChat, Smallcase, Visa, Stripe, Google) directly into the TPO Moderation Queue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-Sync with Keyword */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-sky-600" />
                Filter Keyword Matching
              </h3>
              <div>
                <label className="text-3xs text-slate-500 block mb-1 font-semibold uppercase">Matching Keyword</label>
                <input
                  type="text"
                  value={linkedInKeyword}
                  onChange={e => setLinkedInKeyword(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-sky-500 font-medium"
                  placeholder="e.g. internship, intern, hiring"
                />
              </div>

              <button
                onClick={handleSyncLinkedIn}
                disabled={syncingLinkedIn}
                className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-2"
              >
                {syncingLinkedIn ? 'Synchronizing Opportunities...' : 'Sync Krishan Kumar Feed'}
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick-Paste Direct Post */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-600" />
                Quick-Paste LinkedIn Post
              </h3>
              <textarea
                rows={3}
                value={rawLinkedInPost}
                onChange={e => setRawLinkedInPost(e.target.value)}
                placeholder="Optional: Copy and paste text from any recent LinkedIn post by Krishan Kumar here to extract opportunities instantly..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-sky-500"
              />
              <button
                onClick={handleSyncLinkedIn}
                disabled={syncingLinkedIn || !rawLinkedInPost.trim()}
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition flex items-center justify-center gap-1.5"
              >
                Extract & Import to Moderation Desk
              </button>
            </div>
          </div>

          {/* Sync Result Telemetry */}
          {linkedInSyncResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                <Check className="w-4 h-4 text-emerald-600" />
                LinkedIn Synchronization Complete!
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-emerald-800 pt-1">
                <div><strong>Keyword Filter:</strong> "{linkedInSyncResult.filterKeyword}"</div>
                <div><strong>New Drives Added:</strong> {linkedInSyncResult.newAdded}</div>
                <div><strong>Duplicates Filtered:</strong> {linkedInSyncResult.skippedDuplicates}</div>
              </div>
              <p className="text-xs text-emerald-700">
                All extracted opportunities are now ready in the <strong>Pending Verification</strong> tab for your 1-click review.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: SMART RECOMMENDATION BALANCER (CLEAN BACKEND OS AGING) */}
      {/* ============================================================== */}
      {activeTab === 'priority_system' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Automated Recommendation Balancer
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">Fair Opportunity Distribution Engine</h2>
                <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                  Runs mathematical background balancing to ensure fresh on-campus drives get top priority, while ensuring quality niche openings don't get buried or starved of student visibility.
                </p>
              </div>

              <button
                onClick={handleRunOptimization}
                disabled={optimizingPriority}
                className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-lg transition shadow-xs flex items-center gap-2 shrink-0"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                {optimizingPriority ? 'Optimizing...' : 'Run Automated Visibility Optimization'}
              </button>
            </div>

            {optimizationResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-1.5 text-emerald-900">
                <div className="font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Visibility Cycle Executed Successfully!
                </div>
                <p className="text-xs text-emerald-800">
                  Evaluated {optimizationResult.totalEvaluated} drives: boosted {optimizationResult.promotionsCount} opportunities to ensure equal student visibility.
                </p>
              </div>
            )}

            {/* Distribution Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-600 block">Top Featured Drives</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {telemetry?.queueDistribution?.find(q => q.current_queue === 0)?.total_jobs || 0}
                </span>
                <p className="text-3xs text-slate-500 mt-1">High-priority and recently published opportunities</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-600 block">Standard Rotation</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {telemetry?.queueDistribution?.find(q => q.current_queue === 1)?.total_jobs || 0}
                </span>
                <p className="text-3xs text-slate-500 mt-1">Active drives displayed according to student skill match</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-600 block">Protected Under-Discovered Drives</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">
                  {telemetry?.queueDistribution?.find(q => q.current_queue === 2)?.total_jobs || 0}
                </span>
                <p className="text-3xs text-slate-500 mt-1">Drives receiving automatic visibility boosts</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
