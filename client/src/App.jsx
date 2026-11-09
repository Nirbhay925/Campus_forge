import React, { useState, useEffect } from 'react';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import AdminPortal from './components/AdminPortal';
import { 
  GraduationCap, Briefcase, ShieldCheck, LogOut, User, 
  MapPin, CheckCircle, ChevronDown, Lock, Mail
} from 'lucide-react';

// Seeded pre-configured accounts for instant viva demonstration
const DEMO_ACCOUNTS = [
  { label: 'Rahul Rawat (CSE Student, CGPA 8.5)', email: 'rahul.rawat@gehu.ac.in', role: 'STUDENT', dept: 'CSE' },
  { label: 'Vikram Joshi (ECE Student, Starvation Candidate)', email: 'vikram.joshi@gehu.ac.in', role: 'STUDENT', dept: 'ECE' },
  { label: 'Prof. Amit Verma (Faculty Coordinator)', email: 'prof.verma@gehu.ac.in', role: 'FACULTY', dept: 'Faculty' },
  { label: 'Dr. Rajesh Sharma (TPO Placement Officer)', email: 'tpo@gehu.ac.in', role: 'ADMIN', dept: 'TPO' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [activeRole, setActiveRole] = useState('STUDENT'); // 'STUDENT' | 'FACULTY' | 'ADMIN'
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Manual login modal state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('Password@123');
  const [loginError, setLoginError] = useState(null);

  // Auto-login with Rahul (default student) on initial mount for instant preview
  useEffect(() => {
    quickLogin(DEMO_ACCOUNTS[0].email);
  }, []);

  const loginWithCredentials = async (email, password) => {
    setLoadingLogin(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        setActiveRole(data.user.user_type);
      } else {
        setLoginError(data.message || 'Login failed.');
      }
    } catch (err) {
      setLoginError('Server connection error: ' + err.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  const quickLogin = (email) => {
    loginWithCredentials(email, 'Password@123');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. INSTITUTIONAL TOP BAR */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* College Identity & Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow-inner">
                CF
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-white">CampusForge</span>
                  <span className="text-3xs px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700 font-mono">
                    v2.0 OS Engine
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>Graphic Era Hill University, Bhimtal</span>
                </div>
              </div>
            </div>

            {/* Quick Role Switcher for Viva Demo */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <span className="text-3xs text-slate-400 font-bold uppercase tracking-wider px-2">Viva Fast-Switch:</span>
              {DEMO_ACCOUNTS.map((acc, i) => (
                <button
                  key={i}
                  onClick={() => quickLogin(acc.email)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${user?.email === acc.email ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                >
                  {acc.dept}
                </button>
              ))}
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-white">{user.full_name}</div>
                    <div className="text-3xs text-slate-400">{user.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Not Signed In</span>
              )}
            </div>

          </div>
        </div>

        {/* SUB-HEADER ROLE NAVIGATION BAR */}
        {user && (
          <div className="bg-slate-950/80 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between py-2 text-xs">
              <div className="flex items-center gap-1">
                {user.user_type === 'STUDENT' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                    <GraduationCap className="w-4 h-4" /> Student Portal
                  </span>
                )}
                {user.user_type === 'FACULTY' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                    <Briefcase className="w-4 h-4" /> Faculty Coordinator Portal
                  </span>
                )}
                {user.user_type === 'ADMIN' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4" /> TPO Placement Cell Command
                  </span>
                )}
              </div>

              <div className="text-3xs text-slate-400">
                Operating System Engine: <strong className="text-emerald-400">Active (MLFQ + Starvation Prevention)</strong>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {!token ? (
          /* LOGIN SCREEN */
          <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="text-center space-y-2 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-md">
                CF
              </div>
              <h2 className="text-xl font-bold text-slate-900">Sign in to CampusForge</h2>
              <p className="text-xs text-slate-500">
                Graphic Era Hill University, Bhimtal • Placement Portal
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <span className="text-3xs uppercase font-bold text-slate-400 tracking-wider block">
                Quick Viva Examiner Access (1-Click Login):
              </span>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((acc, i) => (
                  <button
                    key={i}
                    onClick={() => quickLogin(acc.email)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-xs font-medium text-slate-700 transition flex items-center justify-between"
                  >
                    <span>{acc.label}</span>
                    <span className="text-3xs px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">{acc.role}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-3xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or with Email</span></div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); loginWithCredentials(emailInput, passwordInput); }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">University Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="student@gehu.ac.in"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingLogin}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition shadow-sm"
              >
                {loadingLogin ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        ) : (
          /* ACTIVE USER PORTAL VIEW */
          <div>
            {user.user_type === 'STUDENT' && <StudentPortal user={user} token={token} />}
            {user.user_type === 'FACULTY' && <FacultyPortal user={user} token={token} />}
            {user.user_type === 'ADMIN' && <AdminPortal user={user} token={token} />}
          </div>
        )}
      </main>

      {/* 3. INSTITUTIONAL FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            CampusForge — Campus Placement & Internship Intelligence System
          </p>
          <p className="text-3xs text-slate-500">
            Department of Computer Science & Engineering • Graphic Era Hill University, Bhimtal Campus (Uttarakhand)
          </p>
          <p className="text-3xs text-slate-400 font-mono pt-1">
            Core Architecture: MySQL 8.0 3NF ISA Hierarchy • MLFQ Scheduler • Dynamic Starvation Aging Algorithm
          </p>
        </div>
      </footer>
    </div>
  );
}
