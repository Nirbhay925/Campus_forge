import React, { useState, useEffect } from 'react';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import AdminPortal from './components/AdminPortal';
import { 
  GraduationCap, Briefcase, ShieldCheck, LogOut, User, 
  MapPin, Lock, Mail, ChevronRight, School, Sparkles, AlertCircle
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Login form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginSuccess, setLoginSuccess] = useState(null);

  // Restore session from localStorage if available
  useEffect(() => {
    const savedToken = localStorage.getItem('cf_token');
    const savedUser = localStorage.getItem('cf_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  const handleLogin = async (email, password) => {
    if (!email || !password) {
      setLoginError('Please enter both your college email and password.');
      return;
    }

    setLoadingLogin(true);
    setLoginError(null);
    setLoginSuccess(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('cf_token', data.token);
        localStorage.setItem('cf_user', JSON.stringify(data.user));
        setLoginSuccess(data.message || 'Login successful!');
      } else {
        setLoginError(data.message || 'Invalid college email or password.');
      }
    } catch (err) {
      setLoginError('Could not reach university server: ' + err.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
  };

  // Quick Staff Demo Fill (until official university staff directory integration)
  const setStaffCredentials = (type) => {
    if (type === 'faculty') {
      setEmailInput('prof.verma@gehu.ac.in');
      setPasswordInput('Password@123');
    } else if (type === 'tpo') {
      setEmailInput('tpo@gehu.ac.in');
      setPasswordInput('Password@123');
    } else if (type === 'nirbhay') {
      setEmailInput('nirbhaytripathi.240111116@gehu.ac.in');
      setPasswordInput('Nirbhay@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. UNIVERSITY TOP HEADER */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & University Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-black text-xl text-white shadow-md">
                GE
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-white">CampusForge</span>
                  <span className="text-3xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                    Placement Cell
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Graphic Era Hill University • Bhimtal Campus</span>
                </div>
              </div>
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-white">{user.full_name}</div>
                    <div className="text-3xs text-slate-400 font-mono">{user.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 rounded-lg text-xs font-medium transition border border-slate-700"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400 hidden sm:block">
                  Training & Placement Portal
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SUB-HEADER USER ROLE BAR */}
        {user && (
          <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {user.user_type === 'STUDENT' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold text-3xs border border-blue-500/30">
                    <GraduationCap className="w-3.5 h-3.5" /> Student Dashboard
                  </span>
                )}
                {user.user_type === 'FACULTY' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold text-3xs border border-indigo-500/30">
                    <Briefcase className="w-3.5 h-3.5" /> Faculty Coordinator Portal
                  </span>
                )}
                {user.user_type === 'ADMIN' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-3xs border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" /> TPO Central Desk
                  </span>
                )}
                <span className="text-slate-400 text-3xs hidden sm:inline">• Academic Session 2025–2026</span>
              </div>

              <div className="text-3xs text-slate-400">
                Logged in as: <strong className="text-slate-200">{user.full_name}</strong>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 w-full flex flex-col">
        {!token ? (
          /* ============================================================== */
          /* HOME PAGE WITH GRAPHIC ERA BHIMTAL CAMPUS IN BACKGROUND        */
          /* ============================================================== */
          <div className="relative flex-1 flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 sm:p-6 overflow-hidden">
            {/* Real Campus Photo Background with Gradient Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transform filter blur-2xs brightness-90"
              style={{ backgroundImage: "url('/campus.png'), url('/campus.webp')" }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/60 backdrop-blur-xs"></div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
              
              {/* Left Column: Campus Introduction */}
              <div className="lg:col-span-6 text-white space-y-4 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium">
                  <School className="w-3.5 h-3.5" />
                  Graphic Era Hill University, Bhimtal
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  Campus Placement & Internship Intelligence
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto lg:mx-0">
                  Centralized institutional portal for Graphic Era students, faculty coordinators, and the Training & Placement Cell (TPO). Upload your resume to match with active campus drives.
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Automated Resume Matching</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span>TPO Verified Opportunities</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Authentic Institutional Sign-In Card */}
              <div className="lg:col-span-6">
                <div className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Sign in to your Portal</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter your university email address to access your placement dashboard.
                    </p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleLogin(emailInput, passwordInput); }} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        University Email ID
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          value={emailInput}
                          onChange={e => setEmailInput(e.target.value)}
                          placeholder="nirbhaytripathi.240111116@gehu.ac.in"
                          className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                          required
                        />
                      </div>
                      <span className="text-3xs text-slate-500 mt-1 block">
                        Students with <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">@gehu.ac.in</code> IDs can sign in directly with their college password.
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          placeholder="Enter your password..."
                          className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white font-mono"
                          required
                        />
                      </div>
                    </div>

                    {loginError && (
                      <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    {loginSuccess && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        {loginSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loadingLogin}
                      className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2"
                    >
                      {loadingLogin ? 'Authenticating...' : 'Sign In to Portal'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Staff Demo Helper (Discrete & Authentic) */}
                  <div className="pt-3 border-t border-slate-100 text-3xs text-slate-500 space-y-1.5">
                    <span className="font-semibold text-slate-600 uppercase block tracking-wider">
                      University Demo Credentials:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => setStaffCredentials('nirbhay')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition"
                      >
                        Nirbhay (Student)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setStaffCredentials('faculty')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition"
                      >
                        Faculty Coordinator
                      </button>
                      <button 
                        type="button"
                        onClick={() => setStaffCredentials('tpo')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition"
                      >
                        TPO Placement Officer
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* LOGGED IN USER WORKSPACE                                      */
          /* ============================================================== */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
            {user.user_type === 'STUDENT' && <StudentPortal user={user} token={token} />}
            {user.user_type === 'FACULTY' && <FacultyPortal user={user} token={token} />}
            {user.user_type === 'ADMIN' && <AdminPortal user={user} token={token} />}
          </div>
        )}
      </main>

      {/* 3. UNIVERSITY FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            Graphic Era Hill University • Bhimtal Campus (Uttarakhand)
          </p>
          <p className="text-3xs text-slate-500">
            Training & Placement Cell (TPO) • Department of Computer Science & Engineering
          </p>
          <p className="text-3xs text-slate-400 pt-1">
            © 2026 Graphic Era Hill University. All placement and internship circulars are authenticated by TPO.
          </p>
        </div>
      </footer>
    </div>
  );
}
