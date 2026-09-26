import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Heart } from 'lucide-react';
import { authApi } from './authApi';
import { LanguageSelect } from '../user/LanguageContext';
import './auth.css';

export default function Login() {
  const navigate = useNavigate();

  // Tab: 'aadhaar' | 'mobile' | 'abha'
  const [activeTab, setActiveTab] = useState('aadhaar');

  // Input states
  const [identifier, setIdentifier] = useState('');
  const [showMask, setShowMask] = useState(true);

  // OTP states
  const [txnId, setTxnId] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Status & multi-ABHA selection
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);

  const otpInputsRef = useRef([]);

  useEffect(() => {
    let interval;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIdentifier('');
    setOtpSent(false);
    setTxnId(null);
    setOtpDigits(['', '', '', '', '', '']);
    setError('');
    setAccounts([]);
  };

  const formatIdentifier = (val) => {
    if (activeTab === 'aadhaar') {
      const cleaned = val.replace(/\D/g, '').slice(0, 12);
      return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    } else if (activeTab === 'mobile') {
      return val.replace(/\D/g, '').slice(0, 10);
    } else if (activeTab === 'abha') {
      const cleaned = val.replace(/\D/g, '').slice(0, 14);
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
      if (cleaned.length <= 10) return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}-${cleaned.slice(10)}`;
    }
    return val;
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let rawId = identifier.replace(/[\s-]/g, '');
      if (activeTab === 'abha') {
        rawId = identifier;
      }

      const res = await authApi.requestLoginOtp(activeTab, rawId);
      setTxnId(res.txnId);
      setOtpSent(true);
      setTimer(30);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);

      setTimeout(() => {
        if (otpInputsRef.current[0]) {
          otpInputsRef.current[0].focus();
        }
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputsRef.current[nextIdx]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length < 6) return;

    setError('');
    setLoading(true);

    try {
      const res = await authApi.verifyLoginOtp(activeTab, txnId, otp);

      if (res.needsSelection) {
        setAccounts(res.abhaProfiles || res.accounts || []);
        return;
      }

      if (res.tokens?.token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
        localStorage.setItem('token', res.tokens.token);
        if (res.profile) {
          localStorage.setItem('user_profile', JSON.stringify(res.profile));
        }
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAbha = async (abhaNumber) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyUserAbha(txnId, abhaNumber);
      if (res.tokens?.token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user_profile');
        localStorage.setItem('token', res.tokens.token);
        if (res.profile) {
          localStorage.setItem('user_profile', JSON.stringify(res.profile));
        }
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to select profile');
    } finally {
      setLoading(false);
    }
  };

  const isOtpComplete = otpDigits.every((d) => d !== '');

  const getPlaceholder = () => {
    if (activeTab === 'aadhaar') return 'XXXX XXXX XXXX';
    if (activeTab === 'mobile') return 'Enter 10-digit mobile number';
    return '14-digit ABHA Number (XX-XXXX-XXXX-XXXX)';
  };

  const getTabLabel = () => {
    if (activeTab === 'aadhaar') return 'Aadhaar Number';
    if (activeTab === 'mobile') return 'Mobile Number';
    return 'ABHA Number';
  };

  return (
    <div className="mv-auth-container">
      {/* Left Hero Panel */}
      <div className="mv-auth-hero">
        <div className="mv-logo-badge">
          <div className="mv-logo-icon">
            <img src="/mediksha.png" alt="MedIksha" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span>MedIksha</span>
        </div>

        <div className="mv-hero-content">
          <h1 className="mv-hero-title">
            Your Health, <br />
            <span>All In One Place</span>
          </h1>
          <p className="mv-hero-desc">
            Access your complete medical journey securely with verified digital records, ABHA sync, and consent-driven privacy.
          </p>

          <div className="mv-feature-list">
            <div className="mv-feature-item">
              <div className="mv-feature-icon"><Shield size={18} /></div>
              <span>Secure, Encrypted Access</span>
            </div>
            <div className="mv-feature-item">
              <div className="mv-feature-icon"><CheckCircle size={18} /></div>
              <span>Lifetime ABDM Health Records</span>
            </div>
            <div className="mv-feature-item">
              <div className="mv-feature-icon"><Heart size={18} /></div>
              <span>Direct Connect with Verified Doctors</span>
            </div>
          </div>
        </div>

        <div className="mv-hero-footer">
          Better Care Starts with You ♡
        </div>
      </div>

      {/* Right Form Card */}
      <div className="mv-auth-main">
        <div className="mv-auth-card">
          <div className="mv-auth-top-nav">
            <LanguageSelect className="mv-lang-select" />
            <span>New to MedIksha?</span>
            <Link to="/register" className="mv-btn-outline">Create Account</Link>
          </div>

          <div className="mv-card-header">
            <div className="mv-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <img src="/mediksha.png" alt="MedIksha" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--mv-teal)' }}>MedIksha</span>
            </div>
            <h1>Welcome Back!</h1>
            <p>Sign in using your verified health identification</p>
          </div>

          {error && (
            <div className="mv-error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {accounts.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--mv-navy)' }}>
                  Select your ABHA Account
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--mv-text-muted)', background: 'var(--mv-badge-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                  {accounts.length} linked {accounts.length === 1 ? 'account' : 'accounts'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--mv-text-muted)', marginBottom: '1rem', marginTop: 0 }}>
                Multiple accounts found for this mobile number in database. Choose the account you wish to sign in with:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {accounts.map((acc, index) => (
                  <button
                    key={acc.abhaNumber || acc.userId || index}
                    onClick={() => handleSelectAbha(acc.abhaNumber)}
                    disabled={loading}
                    className="mv-btn-outline"
                    style={{
                      textAlign: 'left',
                      padding: '0.9rem 1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      border: '1.5px solid var(--mv-border)',
                      borderRadius: '10px',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--mv-navy)' }}>
                        {acc.name || 'Account'}
                      </strong>
                      {acc.gender && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--mv-teal)', fontWeight: 500, background: 'var(--mv-teal-light)', padding: '2px 6px', borderRadius: '4px' }}>
                          {acc.gender}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--mv-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>ABHA: <strong style={{ color: 'var(--mv-text-body)' }}>{acc.abhaNumber}</strong></span>
                      {acc.abhaAddress && (
                        <span>• {acc.abhaAddress}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAccounts([]);
                  setOtpSent(false);
                  setTxnId(null);
                  setOtpDigits(['', '', '', '', '', '']);
                  setError('');
                }}
                style={{
                  marginTop: '1.25rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--mv-teal)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  padding: '4px 0',
                }}
              >
                <ArrowLeft size={16} /> Back to Login
              </button>
            </div>
          ) : (
            <>
              {/* Method Switcher */}
              <div className="mv-tab-switcher">
                <button
                  type="button"
                  className={`mv-tab-btn ${activeTab === 'aadhaar' ? 'active' : ''}`}
                  onClick={() => handleTabChange('aadhaar')}
                >
                  Aadhaar
                </button>
                <button
                  type="button"
                  className={`mv-tab-btn ${activeTab === 'mobile' ? 'active' : ''}`}
                  onClick={() => handleTabChange('mobile')}
                >
                  Mobile
                </button>
                <button
                  type="button"
                  className={`mv-tab-btn ${activeTab === 'abha' ? 'active' : ''}`}
                  onClick={() => handleTabChange('abha')}
                >
                  ABHA ID
                </button>
              </div>

              {/* Identifier Block */}
              <div className="mv-form-section">
                <label className="mv-form-label">{getTabLabel()}</label>
                <div className="mv-input-group">
                  <input
                    type={activeTab === 'aadhaar' && showMask ? 'password' : 'text'}
                    className="mv-input"
                    placeholder={getPlaceholder()}
                    value={identifier}
                    disabled={otpSent}
                    onChange={(e) => setIdentifier(formatIdentifier(e.target.value))}
                  />
                  {activeTab === 'aadhaar' && (
                    <button
                      type="button"
                      className="mv-input-toggle"
                      onClick={() => setShowMask(!showMask)}
                    >
                      {showMask ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>

                {!otpSent && (
                  <button
                    type="button"
                    className="mv-btn-primary"
                    disabled={!identifier.trim() || loading}
                    onClick={handleSendOtp}
                  >
                    {loading ? 'Sending OTP…' : 'Send OTP'} <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* OTP Block */}
              <div className={`mv-form-section ${!otpSent ? 'dimmed' : ''}`}>
                <label className="mv-form-label">Enter 6-Digit OTP</label>
                <div className="mv-otp-group">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="mv-otp-digit"
                      value={digit}
                      disabled={!otpSent}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                    />
                  ))}
                </div>

                <div className="mv-otp-timer">
                  <span>
                    {timer > 0 ? `Resend OTP in 00:${timer < 10 ? '0' + timer : timer}` : "Didn't receive OTP?"}
                  </span>
                  <button
                    type="button"
                    className="mv-link-btn"
                    disabled={!canResend || loading}
                    onClick={handleSendOtp}
                  >
                    Resend OTP
                  </button>
                </div>

                <button
                  type="button"
                  className="mv-btn-primary"
                  disabled={!isOtpComplete || loading || !otpSent}
                  onClick={handleVerifyOtp}
                >
                  {loading ? 'Verifying…' : 'Verify OTP'} <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <Link to="/dashboard" style={{ color: 'var(--mv-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back to Home
            </Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--mv-text-muted)' }}>
              <Shield size={14} color="#1A8C7A" /> Data protected & ABDM compliant
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
