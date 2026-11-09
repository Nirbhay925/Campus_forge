import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Check, X, RefreshCw, Sparkles, AlertTriangle, 
  Cpu, Layers, ExternalLink, Activity, Send, Filter
} from 'lucide-react';

export default function AdminPortal({ user, token }) {
  const [activeTab, setActiveTab] = useState('moderation'); // 'moderation' | 'linkedin' | 'os_telemetry'
  
  // Moderation state
  const [pendingQueue, setPendingQueue] = useState([]);
  const [loadingMod, setLoadingMod] = useState(true);

  // LinkedIn Krishan Kumar state
  const [linkedInKeyword, setLinkedInKeyword] = useState('internship');
  const [rawLinkedInPost, setRawLinkedInPost] = useState('');
  const [syncingLinkedIn, setSyncingLinkedIn] = useState(false);
  const [linkedInSyncResult, setLinkedInSyncResult] = useState(null);

  // OS Telemetry state
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [triggeringAging, setTriggeringAging] = useState(false);
  const [agingSimulationResult, setAgingSimulationResult] = useState(null);

  // Load Pending Moderation Queue
  const loadModerationQueue = async () => {
    setLoadingMod(true);
    try {
      const res = await fetch('/api/admin/moderation', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingQueue(data.opportunities);
      }
    } catch (err) {
      console.error('Error fetching moderation queue:', err);
    } finally {
      setLoadingMod(false);
    }
  };

  // Load OS Telemetry
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
      console.error('Error loading OS telemetry:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadModerationQueue();
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
        loadTelemetry(); // Update queue telemetry
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error verifying drive: ' + err.message);
    }
  };

  // Handle Rejection
  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this circular?')) return;
    try {
      const res = await fetch(`/api/admin/moderation/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPendingQueue(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      alert('Error rejecting drive: ' + err.message);
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
        loadModerationQueue(); // Refresh pending queue to review imported jobs
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error syncing LinkedIn feed: ' + err.message);
    } finally {
      setSyncingLinkedIn(false);
    }
  };

  // Handle Viva Aging Simulation Trigger
  const handleTriggerAging = async (forceBoost = false) => {
    setTriggeringAging(true);
    setAgingSimulationResult(null);

    try {
      const res = await fetch('/api/admin/trigger-aging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          time_step_hours: 24,
          force_epoch_boost: forceBoost,
          starvation_threshold: 3
        })
      });
      const data = await res.json();
      if (data.success) {
        setAgingSimulationResult(data.cycleSummary);
        loadTelemetry(); // Refresh OS telemetry
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error simulating aging: ' + err.message);
    } finally {
      setTriggeringAging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TPO COMMAND HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Training & Placement Cell (TPO) Officer Portal
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{user?.full_name}</h1>
            <p className="text-sm text-slate-600">
              Central Moderation Gate & Operating System Telemetry • GEHU Bhimtal
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-center">
              <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Pending Moderation</span>
              <span className="text-lg font-bold text-amber-600">{pendingQueue.length}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-center">
              <span className="text-3xs text-slate-500 uppercase tracking-wider block font-semibold">Active in MLFQ</span>
              <span className="text-lg font-bold text-blue-700">
                {telemetry?.queueDistribution?.reduce((acc, q) => acc + q.total_jobs, 0) || 0}
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex gap-2 mt-5 border-t border-slate-100 pt-3">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${activeTab === 'moderation' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            TPO Moderation Queue ({pendingQueue.length})
          </button>

          <button
            onClick={() => setActiveTab('linkedin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${activeTab === 'linkedin' ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Krishan Kumar LinkedIn Stream
          </button>

          <button
            onClick={() => setActiveTab('os_telemetry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${activeTab === 'os_telemetry' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Operating System & Aging Telemetry
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MODERATION QUEUE */}
      {/* ============================================================== */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Pending Circulars Awaiting Verification ({pendingQueue.length})
            </h2>
            <button 
              onClick={loadModerationQueue}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loadingMod ? (
            <div className="bg-white p-8 text-center text-slate-400 rounded-xl border border-slate-200">
              Loading pending queue...
            </div>
          ) : pendingQueue.length === 0 ? (
            <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">All Circulars Reviewed!</h3>
              <p className="text-xs text-slate-500 mt-1">There are no pending circulars in the moderation queue.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingQueue.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {item.company_name}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{item.title}</h3>
                    </div>
                    <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                      {item.source}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3">{item.description}</p>

                  <div className="bg-slate-50 p-2.5 rounded-lg grid grid-cols-2 gap-2 text-3xs text-slate-600">
                    <div><strong>Min Cutoff:</strong> {Number(item.min_cgpa).toFixed(1)} CGPA</div>
                    <div><strong>Eligible Branches:</strong> {item.eligible_branches}</div>
                    <div><strong>Stipend:</strong> {item.stipend_amount}</div>
                    <div><strong>Submitted by:</strong> {item.posted_by_name || 'Autonomous Scraper'}</div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {item.required_skills?.map((s, idx) => (
                      <span key={idx} className="text-3xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <a
                      href={item.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      Inspect Portal Link <ExternalLink className="w-3 h-3" />
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleVerify(item.id)}
                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        1-Click Verify
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
      {/* TAB 2: KRISHAN KUMAR LINKEDIN INGESTION STREAM */}
      {/* ============================================================== */}
      {activeTab === 'linkedin' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                Verified Creator Feed
              </span>
              <a 
                href="https://www.linkedin.com/in/krishan-kumar08" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-sky-700 hover:underline flex items-center gap-1 font-mono font-medium"
              >
                https://www.linkedin.com/in/krishan-kumar08 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Krishan Kumar Internship Ingestion Stream</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Filters public openings curated by Krishan Kumar specifically matching the keyword <strong className="text-slate-800">"internship"</strong>. Ingests Red Hat, Salesforce, ShareChat, Smallcase, and MNC fresher openings directly into the TPO moderation queue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-Sync with Keyword */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-sky-600" />
                Keyword Filter Synchronization
              </h3>
              <div>
                <label className="text-3xs text-slate-500 block mb-1 font-semibold uppercase">Target Keyword</label>
                <input
                  type="text"
                  value={linkedInKeyword}
                  onChange={e => setLinkedInKeyword(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-sky-500 font-medium"
                  placeholder="e.g. internship, intern, hiring"
                />
              </div>

              <button
                onClick={handleSyncLinkedIn}
                disabled={syncingLinkedIn}
                className="w-full py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {syncingLinkedIn ? 'Syncing Feed...' : 'Sync Krishan Kumar Feed'}
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick-Paste Direct Post */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-600" />
                Quick-Paste Raw Post
              </h3>
              <textarea
                rows={3}
                value={rawLinkedInPost}
                onChange={e => setRawLinkedInPost(e.target.value)}
                placeholder="Optional: Paste text of any recent LinkedIn post by Krishan Kumar here to immediately extract and import it..."
                className="w-full text-3xs p-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-sky-500 font-mono"
              />
              <button
                onClick={handleSyncLinkedIn}
                disabled={syncingLinkedIn || !rawLinkedInPost.trim()}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition flex items-center justify-center gap-1"
              >
                Parse & Import Raw Post
              </button>
            </div>
          </div>

          {/* Sync Result Telemetry */}
          {linkedInSyncResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                LinkedIn Synchronization Complete!
              </div>
              <div className="grid grid-cols-3 gap-2 text-3xs text-emerald-800">
                <div><strong>Keyword:</strong> "{linkedInSyncResult.filterKeyword}"</div>
                <div><strong>New Jobs Added:</strong> {linkedInSyncResult.newAdded}</div>
                <div><strong>Duplicates Skipped:</strong> {linkedInSyncResult.skippedDuplicates}</div>
              </div>
              <p className="text-3xs text-emerald-700">
                Opportunities routed to TPO Moderation Queue with source <code className="bg-emerald-100 px-1 rounded">LINKEDIN_PUBLIC</code> and attributed to Krishan Kumar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: OPERATING SYSTEM & AGING TELEMETRY (VIVA DEMO CENTER) */}
      {/* ============================================================== */}
      {activeTab === 'os_telemetry' && (
        <div className="space-y-6">
          {/* VIVA DEMO BANNER & CLOCK TICK BUTTON */}
          <div className="bg-indigo-900 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-2.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-indigo-800 border border-indigo-700">
                Viva Demonstration Controller
              </span>
              <h2 className="text-lg font-bold mt-1">Operating System Multi-Level Feedback Queue Engine</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Simulate OS time slices and dynamic aging ticks live in front of examiners to prove starvation rescue.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTriggerAging(false)}
                disabled={triggeringAging}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-semibold text-xs rounded-lg transition border border-indigo-500 shadow-sm"
              >
                {triggeringAging ? 'Simulating...' : 'Simulate 24h Clock Tick'}
              </button>

              <button
                onClick={() => handleTriggerAging(true)}
                disabled={triggeringAging}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5"
                title="Force MLFQ Rule 5: Priority Boost all Q2 candidates"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Force Starvation Rescue (Epoch Boost)
              </button>
            </div>
          </div>

          {/* SIMULATION RESULT ALERT */}
          {agingSimulationResult && (
            <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm text-xs space-y-2">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                OS Scheduling Cycle Complete (Simulated {agingSimulationResult.timeStepHoursSimulated}h)
              </div>
              <div className="flex gap-4 text-slate-700 text-3xs">
                <span>Evaluated: <strong>{agingSimulationResult.totalEvaluated}</strong> drives</span>
                <span>Promoted / Rescued: <strong className="text-emerald-700">+{agingSimulationResult.promotionsCount}</strong></span>
                <span>Demoted: <strong className="text-amber-700">-{agingSimulationResult.demotionsCount}</strong></span>
              </div>
            </div>
          )}

          {/* QUEUE DISTRIBUTION METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Queue 0 (Highest / Fresh)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-3xs">48h Quantum</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {telemetry?.queueDistribution?.find(q => q.current_queue === 0)?.total_jobs || 0}
              </div>
              <p className="text-3xs text-slate-500 mt-1">Urgent on-campus drives & recently rescued opportunities</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Queue 1 (Standard Active)</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-3xs">96h Quantum</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {telemetry?.queueDistribution?.find(q => q.current_queue === 1)?.total_jobs || 0}
              </div>
              <p className="text-3xs text-slate-500 mt-1">Normal active drives progressing through quantum</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Queue 2 (Background / Niche)</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-3xs">240h Quantum</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {telemetry?.queueDistribution?.find(q => q.current_queue === 2)?.total_jobs || 0}
              </div>
              <p className="text-3xs text-slate-500 mt-1">Starvation candidates undergoing dynamic aging calculations</p>
            </div>
          </div>

          {/* STARVING JOBS WATCHLIST */}
          {telemetry?.starvingJobs?.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Starvation Watchlist (0 Student Clicks)</h3>
                </div>
                <span className="text-3xs text-amber-800 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  Protected by Dynamic Aging Formula
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-3xs">
                    <tr>
                      <th className="px-3 py-2">Company & Role</th>
                      <th className="px-3 py-2">Current Queue</th>
                      <th className="px-3 py-2">Starvation Counter</th>
                      <th className="px-3 py-2">Aging Boost Applied</th>
                      <th className="px-3 py-2">Final Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {telemetry.starvingJobs.map(job => (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {job.company_name} — {job.title}
                        </td>
                        <td className="px-3 py-2 font-mono">Queue {job.current_queue}</td>
                        <td className="px-3 py-2 text-amber-700 font-bold">{job.starvation_counter} cycles</td>
                        <td className="px-3 py-2 text-emerald-700 font-bold">+{Number(job.aging_boost_score).toFixed(1)} pts</td>
                        <td className="px-3 py-2 font-black text-slate-900">{job.final_priority_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IMMUTABLE SCHEDULER AUDIT LOGS */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Scheduler Audit Trail (Examiner Viva Proof)</h3>
                <p className="text-xs text-slate-500">Immutable log of queue demotions, promotions, and starvation rescues.</p>
              </div>
              <button onClick={loadTelemetry} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-3xs sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Opportunity</th>
                    <th className="px-3 py-2">Action Type</th>
                    <th className="px-3 py-2">Transition</th>
                    <th className="px-3 py-2">Boost</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telemetry?.recentAuditLogs?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">No scheduler actions recorded yet.</td>
                    </tr>
                  ) : (
                    telemetry?.recentAuditLogs?.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 text-3xs">
                        <td className="px-3 py-2 text-slate-400 font-mono">
                          {new Date(log.executed_at).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {log.company_name}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${log.action_type === 'STARVATION_RESCUE' || log.action_type === 'PRIORITY_BOOST_CYCLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold">
                          Q{log.old_queue} → Q{log.new_queue}
                        </td>
                        <td className="px-3 py-2 text-emerald-700 font-bold">
                          +{Number(log.aging_score_applied).toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-xs truncate">
                          {log.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
