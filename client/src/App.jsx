import React, { useState, useEffect } from 'react';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import AdminPortal from './components/AdminPortal';
import { 
  GraduationCap, Briefcase, ShieldCheck, LogOut, User, 
  MapPin, Lock, Mail, ChevronRight, School, Sparkles, AlertCircle,
  KeyRound, CheckCircle2, ShieldAlert, ArrowLeft, RefreshCw
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'

  // Sign In state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [loginSuccess, setLoginSuccess] = useState(null);
  const [lockedSessionInfo, setLockedSessionInfo] = useState(null); // { is_locked, active_device, last_active_at }

  // Sign Up state (First-time GEHU OTP Registration)
  const [signupStep, setSignupStep] = useState(1); // 1: Input details -> 2: Enter OTP
  const [signupName, setSignupName] = useState('');
  const [signupRoll, setSignupRoll] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDept, setSignupDept] = useState('CSE');
  const [signupBatch, setSignupBatch] = useState('2028');
  const [signupOtp, setSignupOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState(null);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(null);

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

  // Handle Login with Single Device Lock Check
  const handleLogin = async (identifier, password, forceLogout = false) => {
    if (!identifier || !password) {
      setLoginError('Please enter both your college email / roll number and password.');
      return;
    }

    setLoadingLogin(true);
    setLoginError(null);
    setLoginSuccess(null);
    setLockedSessionInfo(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: identifier.trim(), 
          password,
          force_logout: forceLogout
        })
      });
      const data = await res.json();

      if (res.status === 409 && data.is_locked) {
        // Device Lock Active: another device is logged in
        setLockedSessionInfo(data);
        return;
      }

      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('cf_token', data.token);
        localStorage.setItem('cf_user', JSON.stringify(data.user));
        setLoginSuccess(data.message || 'Login successful!');
      } else {
        setLoginError(data.message || 'Invalid credentials.');
      }
    } catch (err) {
      setLoginError('Could not reach university server: ' + err.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  // Handle Step 1 of Sign Up: Request 6-digit OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setSignupError(null);
    setDevOtpHint(null);

    if (!signupName.trim() || !signupRoll.trim() || !signupEmail.trim() || !signupPassword) {
      setSignupError('Please complete all required fields.');
      return;
    }

    if (!signupEmail.toLowerCase().endsWith('@gehu.ac.in')) {
      setSignupError('Access Restricted: You must use your official Graphic Era email address (@gehu.ac.in).');
      return;
    }

    setLoadingSignup(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          roll_number: signupRoll.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSignupStep(2);
        setSignupSuccess(data.message);
        if (data.dev_otp) {
          setDevOtpHint(data.dev_otp);
        }
      } else {
        setSignupError(data.message);
      }
    } catch (err) {
      setSignupError('Network error requesting OTP: ' + err.message);
    } finally {
      setLoadingSignup(false);
    }
  };

  // Handle Step 2 of Sign Up: Verify OTP & Activate Account
  const handleVerifyOtpAndRegister = async (e) => {
    e.preventDefault();
    setSignupError(null);

    if (!signupOtp || signupOtp.trim().length !== 6) {
      setSignupError('Please enter the 6-digit verification code.');
      return;
    }

    setLoadingSignup(true);

    try {
      const res = await fetch('/api/auth/verify-otp-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          roll_number: signupRoll.trim(),
          full_name: signupName.trim(),
          password: signupPassword,
          department: signupDept,
          batch_year: signupBatch,
          otp_code: signupOtp.trim()
        })
      });

      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('cf_token', data.token);
        localStorage.setItem('cf_user', JSON.stringify(data.user));
      } else {
        setSignupError(data.message);
      }
    } catch (err) {
      setSignupError('Error activating account: ' + err.message);
    } finally {
      setLoadingSignup(false);
    }
  };

  // Handle Logout (Releases MySQL device session lock)
  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.warn('Logout release warning:', err.message);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      setLockedSessionInfo(null);
      setAuthMode('signin');
    }
  };

  // Quick Staff Demo Fill (until official university staff directory integration)
  const setStaffCredentials = (type) => {
    setAuthMode('signin');
    setLockedSessionInfo(null);
    if (type === 'faculty') {
      setEmailInput('faculty@gehu.ac.in');
      setPasswordInput('Faculty@123');
    } else if (type === 'tpo') {
      setEmailInput('tpo@gehu.ac.in');
      setPasswordInput('Admin@123');
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
                    title="Sign Out (Releases Device Lock)"
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
            <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
              
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
                  Official placement portal for Graphic Era students, faculty coordinators, and TPO. Match your resume with verified campus drives and authentic tech internships.
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>1-Time College Email OTP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span>Single Active Device Lock</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>TPO Verified Drives</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Institutional Auth Card (Tabs: Sign In vs Sign Up) */}
              <div className="lg:col-span-6">
                <div className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
                  
                  {/* AUTH TABS */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signin'); setLoginError(null); setLockedSessionInfo(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                        authMode === 'signin' 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signup'); setSignupError(null); setSignupStep(1); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                        authMode === 'signup' 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Create Student Account
                    </button>
                  </div>

                  {/* ==================================================== */}
                  {/* TAB 1: SIGN IN FORM                                   */}
                  {/* ==================================================== */}
                  {authMode === 'signin' && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Sign in to your Portal</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Enter your College Email ID or Roll Number along with your password.
                        </p>
                      </div>

                      {/* DEVICE LOCK ACTIVE WARNING BANNER */}
                      {lockedSessionInfo && (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs space-y-3">
                          <div className="flex items-start gap-2.5 text-amber-900 font-bold">
                            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-sm font-extrabold text-amber-950">Active Session on Another Device!</div>
                              <p className="text-xs text-amber-800 font-normal mt-1 leading-relaxed">
                                This student account is currently active on: <strong className="font-semibold text-slate-900">{lockedSessionInfo.active_device}</strong>. To prevent account sharing and unauthorized access, concurrent logins are locked.
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-amber-200/80 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handleLogin(emailInput, passwordInput, true)}
                              disabled={loadingLogin}
                              className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Force Logout Other Device & Sign In Here
                            </button>
                            <span className="text-3xs text-amber-700 text-center">
                              This will immediately revoke access on the other device and transfer your login here.
                            </span>
                          </div>
                        </div>
                      )}

                      <form onSubmit={(e) => { e.preventDefault(); handleLogin(emailInput, passwordInput); }} className="space-y-3.5">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            College Email or Roll Number
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                              type="text"
                              value={emailInput}
                              onChange={e => setEmailInput(e.target.value)}
                              placeholder="e.g. 240111116 or nirbhaytripathi.240111116@gehu.ac.in"
                              className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                              required
                            />
                          </div>
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
                          <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{loginSuccess}</span>
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

                      {/* Demo Quick-Fill Buttons */}
                      <div className="pt-2 border-t border-slate-100 text-3xs text-slate-500 space-y-1">
                        <span className="font-semibold text-slate-600 uppercase block tracking-wider">
                          Test Credentials:
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
                            TPO Placement Cell
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* TAB 2: SIGN UP / OTP ONBOARDING                      */}
                  {/* ==================================================== */}
                  {authMode === 'signup' && (
                    <div className="space-y-4">
                      {signupStep === 1 ? (
                        <>
                          <div>
                            <span className="text-3xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Step 1 of 2: College Identity Verification
                            </span>
                            <h2 className="text-lg font-bold text-slate-900 mt-1">First-Time Student Registration</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Enter your details to receive a 1-time verification code on your official college email.
                            </p>
                          </div>

                          <form onSubmit={handleRequestOtp} className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={signupName}
                                onChange={e => setSignupName(e.target.value)}
                                placeholder="e.g. Nirbhay Tripathi"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                  University Roll No
                                </label>
                                <input
                                  type="text"
                                  value={signupRoll}
                                  onChange={e => setSignupRoll(e.target.value)}
                                  placeholder="e.g. 240111116"
                                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white font-mono"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                  Department
                                </label>
                                <select
                                  value={signupDept}
                                  onChange={e => setSignupDept(e.target.value)}
                                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                                >
                                  <option value="CSE">CSE</option>
                                  <option value="IT">IT</option>
                                  <option value="ECE">ECE</option>
                                  <option value="MECH">MECH</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Official Graphic Era Email (@gehu.ac.in)
                              </label>
                              <input
                                type="email"
                                value={signupEmail}
                                onChange={e => setSignupEmail(e.target.value)}
                                placeholder="e.g. nirbhaytripathi.240111116@gehu.ac.in"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white"
                                required
                              />
                              <span className="text-3xs text-slate-400 mt-1 block">
                                An OTP will be dispatched to this college inbox to prove ownership.
                              </span>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                Choose Account Password
                              </label>
                              <input
                                type="password"
                                value={signupPassword}
                                onChange={e => setSignupPassword(e.target.value)}
                                placeholder="Create a secure password..."
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-600 bg-white font-mono"
                                required
                              />
                            </div>

                            {signupError && (
                              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                                {signupError}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={loadingSignup}
                              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2"
                            >
                              {loadingSignup ? 'Sending Verification Code...' : 'Send 6-Digit OTP to College Email'}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </form>
                        </>
                      ) : (
                        /* STEP 2: ENTER OTP */
                        <>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSignupStep(1)}
                              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 font-medium"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" /> Back to details
                            </button>
                            <span className="text-3xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Step 2 of 2: Email Verification
                            </span>
                            <h2 className="text-lg font-bold text-slate-900 mt-1">Enter Verification Code</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                              We sent a 6-digit OTP to <strong className="text-slate-800 font-mono">{signupEmail}</strong>.
                            </p>
                          </div>

                          {devOtpHint && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1">
                              <span className="font-bold flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                Local Development OTP Helper:
                              </span>
                              <p className="text-xs">
                                Verification Code: <strong className="font-mono text-sm bg-blue-100 px-2 py-0.5 rounded text-blue-950">{devOtpHint}</strong>
                              </p>
                            </div>
                          )}

                          <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 block mb-1">
                                6-Digit Verification Code (OTP)
                              </label>
                              <div className="relative">
                                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                <input
                                  type="text"
                                  maxLength={6}
                                  value={signupOtp}
                                  onChange={e => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                                  placeholder="e.g. 123456"
                                  className="w-full text-base font-bold tracking-widest pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 bg-white font-mono text-center"
                                  required
                                  autoFocus
                                />
                              </div>
                              <span className="text-3xs text-slate-400 mt-1 block">
                                This OTP is required only once. After activation, you will log in directly with your password.
                              </span>
                            </div>

                            {signupError && (
                              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                                {signupError}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={loadingSignup || signupOtp.length !== 6}
                              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2"
                            >
                              {loadingSignup ? 'Activating Account...' : 'Verify OTP & Activate Profile'}
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  )}

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
