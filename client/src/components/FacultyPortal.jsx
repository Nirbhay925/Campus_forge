import React, { useState, useEffect } from 'react';
import { 
  Send, Sparkles, AlertCircle, CheckCircle, Clock, Eye, 
  Layers, Check, ExternalLink, RefreshCw, PlusCircle
} from 'lucide-react';

export default function FacultyPortal({ user, token }) {
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  const [myDrives, setMyDrives] = useState([]);
  const [loadingDrives, setLoadingDrives] = useState(true);

  // Fetch faculty's posted drives
  const loadMyDrives = async () => {
    setLoadingDrives(true);
    try {
      const res = await fetch('/api/faculty/my-drives', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyDrives(data.drives);
      }
    } catch (err) {
      console.error('Error loading faculty drives:', err);
    } finally {
      setLoadingDrives(false);
    }
  };

  useEffect(() => {
    loadMyDrives();
  }, [token]);

  // Handle WhatsApp Preview Parsing
  const handleParsePreview = async () => {
    if (!rawText.trim()) {
      alert('Please paste raw WhatsApp circular text first.');
      return;
    }

    setParsing(true);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/faculty/parse-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ raw_message: rawText })
      });
      const data = await res.json();
      if (data.success) {
        setParsedResult(data);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error parsing WhatsApp text:', err);
      alert('Failed to parse text: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // Submit all parsed drives to TPO moderation queue
  const handleSubmitBatch = async () => {
    if (!parsedResult || !parsedResult.opportunities || parsedResult.opportunities.length === 0) return;

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/faculty/batch-post-drives', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ opportunities: parsedResult.opportunities })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitMessage({
          type: 'success',
          text: data.message
        });
        setParsedResult(null);
        setRawText('');
        loadMyDrives(); // Refresh my posted drives table
      } else {
        setSubmitMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setSubmitMessage({ type: 'error', text: 'Error submitting drive: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. FACULTY HEADER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Faculty Placement Coordinator Portal
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{user?.full_name}</h1>
            <p className="text-sm text-slate-600">
              Departmental Placement & Internship Intelligence Desk • GEHU Bhimtal
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center">
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-medium">My Ingested Drives</span>
            <span className="text-lg font-bold text-indigo-700">{myDrives.length}</span>
          </div>
        </div>
      </div>

      {/* 2. WHATSAPP CIRCULAR INGESTION DESK */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            WhatsApp Circular Ingestion & Heuristic Extraction
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Paste raw text from departmental WhatsApp messages. Automatically segments multi-link digests (e.g. Visa, Stripe, Google) and infers missing skills and CGPA cutoffs.
          </p>
        </div>

        <textarea
          rows={5}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder="Paste raw WhatsApp announcement here...&#10;e.g.&#10;VISA – Intern&#10;https://visa.wd5.myworkdayjobs.com/...&#10;&#10;Stripe – Software Engineer, Intern&#10;https://stripe.com/careers/..."
          className="w-full text-xs p-3 font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white transition"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={() => setRawText(`Intern\nAbout Us Visa is a world leader in payments technology...\n\nVISA – Intern\nhttps://visa.wd5.myworkdayjobs.com/en-US/Visa_Talent_Portal/job/Intern_REF084196W\n\nStripe – Software Engineer, Intern\nhttps://stripe.com/careers/listing/software-engineer-intern/8031833\n\nGoogle – Software Engineer, Payments\nhttps://www.google.com/about/careers/applications/jobs/results/143561253581660870-software-engineer/`)}
            className="text-xs text-indigo-700 hover:underline font-medium"
          >
            Load Sample Real WhatsApp Circular
          </button>

          <button
            onClick={handleParsePreview}
            disabled={parsing || !rawText.trim()}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            {parsing ? 'Extracting Data...' : 'Preview Extracted Opportunities'}
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* PARSED PREVIEW RESULTS */}
        {parsedResult && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                  Detected {parsedResult.count} Opportunity Block{parsedResult.count > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-slate-500">Review details before sending to TPO verification queue.</span>
              </div>

              <button
                onClick={handleSubmitBatch}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                {submitting ? 'Submitting...' : `1-Click Submit All ${parsedResult.count} Drives to TPO`}
                <Check className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {parsedResult.opportunities.map((opp, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{opp.company_name}</span>
                    <span className="text-slate-500 text-3xs font-mono">Job #{idx + 1}</span>
                  </div>
                  <div className="font-semibold text-slate-800 text-sm">{opp.title}</div>
                  <div className="text-slate-600 line-clamp-2 text-3xs">{opp.description}</div>
                  
                  <div className="pt-1 border-t border-slate-200 grid grid-cols-2 gap-1 text-3xs text-slate-600">
                    <div><strong>Min CGPA:</strong> {opp.min_cgpa || '0.0 (All)'}</div>
                    <div><strong>Branches:</strong> {opp.eligible_branches}</div>
                    <div><strong>Stipend:</strong> {opp.stipend_amount}</div>
                    <div><strong>Deadline:</strong> +14 Days</div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {opp.required_skills?.map((sk, ski) => (
                      <span key={ski} className="px-1.5 py-0.5 rounded text-3xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {submitMessage && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${submitMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{submitMessage.text}</span>
          </div>
        )}
      </div>

      {/* 3. MY SUBMITTED DRIVES TELEMETRY TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Submitted Circulars & Student Engagement</h2>
            <p className="text-xs text-slate-500">Real-time status tracking in TPO Moderation & Operating System Queue.</p>
          </div>
          <button 
            onClick={loadMyDrives} 
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-3xs border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Opportunity</th>
                <th className="px-4 py-3">Eligibility</th>
                <th className="px-4 py-3">TPO Gate Status</th>
                <th className="px-4 py-3">OS MLFQ Priority</th>
                <th className="px-4 py-3">Student Apply Clicks</th>
                <th className="px-4 py-3">Date Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingDrives ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Loading drives...</td>
                </tr>
              ) : myDrives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No circulars submitted yet. Paste a WhatsApp message above to submit your first drive!
                  </td>
                </tr>
              ) : (
                myDrives.map(drive => (
                  <tr key={drive.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{drive.title}</div>
                      <div className="text-slate-500 text-3xs">{drive.company_name} • {drive.work_mode}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>Min {Number(drive.min_cgpa).toFixed(1)} CGPA</div>
                      <div className="text-3xs text-slate-400">{drive.eligible_branches}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-3xs font-bold border ${drive.verification_status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : drive.verification_status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {drive.verification_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-800 font-semibold">Queue {drive.current_queue ?? 0}</span>
                      <span className="text-3xs text-slate-400 block">48h Quantum</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900">{drive.apply_clicks ?? 0}</span>
                      <span className="text-slate-400 text-3xs block">applicants clicked</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-3xs">
                      {new Date(drive.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
