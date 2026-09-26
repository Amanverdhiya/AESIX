import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Heart } from 'lucide-react';
import { authApi } from './authApi';
import { LanguageSelect } from '../user/LanguageContext';
import './auth.css';

export default function Register() {
  const navigate = useNavigate();

  // Multi-step progress (1 to 4)
  const [step, setStep] = useState(1);

  // Form states
  const [aadhaar, setAadhaar] = useState('');
  const [showMask, setShowMask] = useState(true);

  // OTP states
  const [txnId, setTxnId] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Personal Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('MALE');
  const [city, setCity] = useState('');

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const formatAadhaar = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 12);
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const rawAadhaar = aadhaar.replace(/\s/g, '');
    if (rawAadhaar.length !== 12) {
      setError('Aadhaar must be exactly 12 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await authApi.requestRegisterOtp(rawAadhaar);
      setTxnId(res.txnId);
      setOtpSent(true);
      setTimer(30);
      setCanResend(false);
      setTimeout(() => {
        if (otpInputsRef.current[0]) otpInputsRef.current[0].focus();
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to send registration OTP');
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

  const handleVerifyOtpLocal = (e) => {
    if (e) e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length < 6) return;

    // Backend registers in one /register/enroll call with txnId + otp + form details
    setOtpVerified(true);
    setStep(2);
    setError('');
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const rawAadhaar = aadhaar.replace(/\s/g, '');
    const fullName = `${firstName} ${lastName}`.trim();

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');

      const payload = {
        txnId,
        aadhaar: rawAadhaar,
        otp: otpDigits.join(''),
        name: fullName,
        mobile: mobile.replace(/\D/g, ''),
        gender,
        dob,
        city,
      };

      const res = await authApi.enrollRegister(payload);
      if (res.tokens?.token) {
        localStorage.setItem('token', res.tokens.token);
        if (res.profile) {
          localStorage.setItem('user_profile', JSON.stringify(res.profile));
        }
      }
      setStep(4);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isOtpComplete = otpDigits.every((d) => d !== '');

  return (
    <div className="mv-auth-container">
      {/* Left Panel */}
      <div className="mv-auth-hero">
        <div className="mv-logo-badge">
          <div className="mv-logo-icon">
            <img src="/mediksha.png" alt="MedIksha" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span>MedIksha</span>
        </div>

        <div className="mv-hero-content">
          <h1 className="mv-hero-title">
            Create Your <br />
            <span>Health Profile</span>
          </h1>
          <p className="mv-hero-desc">
            Link your Aadhaar & ABHA to access a unified digital health ecosystem with secure consent access.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="mv-badge-pill">
              <Shield size={16} /> Secure Government ABDM Gateway
            </div>
            <div className="mv-badge-pill">
              <CheckCircle size={16} /> All Records In One Place
            </div>
            <div className="mv-badge-pill">
              <Heart size={16} /> AI Health Assistant & Insights
            </div>
          </div>
        </div>

        <div className="mv-hero-footer">
          Better Care Starts with You ♡
        </div>
      </div>

      {/* Right Card */}
      <div className="mv-auth-main">
        <div className="mv-auth-card" style={{ maxWidth: '580px' }}>
          <div className="mv-auth-top-nav">
            <LanguageSelect className="mv-lang-select" />
            <span>Already have an account?</span>
            <Link to="/login" className="mv-btn-outline">Login</Link>
          </div>

          <div className="mv-card-header">
            <div className="mv-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <img src="/mediksha.png" alt="MedIksha" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--mv-teal)' }}>MedIksha</span>
            </div>
            <h1>Register with MedIksha</h1>
            <p>Create your verified ABDM digital health account</p>
          </div>

          {/* Stepper */}
          <div className="mv-stepper">
            <div className={`mv-step ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <div className="mv-step-num">{step > 1 ? '✓' : '1'}</div>
              <span className="mv-step-title">Aadhaar & OTP</span>
            </div>
            <div className={`mv-step-connector ${step > 1 ? 'active' : ''}`} />

            <div className={`mv-step ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <div className="mv-step-num">{step > 2 ? '✓' : '2'}</div>
              <span className="mv-step-title">Personal</span>
            </div>
            <div className={`mv-step-connector ${step > 2 ? 'active' : ''}`} />

            <div className={`mv-step ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <div className="mv-step-num">{step > 3 ? '✓' : '3'}</div>
              <span className="mv-step-title">Contact</span>
            </div>
            <div className={`mv-step-connector ${step > 3 ? 'active' : ''}`} />

            <div className={`mv-step ${step === 4 ? 'active' : ''}`}>
              <div className="mv-step-num">4</div>
              <span className="mv-step-title">Complete</span>
            </div>
          </div>

          {error && (
            <div className="mv-error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {step === 4 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <CheckCircle size={54} color="#1A8C7A" style={{ margin: '0 auto 1rem' }} />
              <h2>Account Created Successfully!</h2>
              <p style={{ color: 'var(--mv-text-muted)', marginTop: '0.5rem' }}>
                Redirecting you to your health dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Step 1: Aadhaar & OTP */}
              <div className="mv-form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="mv-form-label" style={{ margin: 0 }}>Aadhaar Number</label>
                  {otpVerified && <span className="mv-success-badge"><CheckCircle size={14} /> Verified</span>}
                </div>
                
                <div className="mv-input-group">
                  <input
                    type={showMask ? 'password' : 'text'}
                    className="mv-input"
                    placeholder="XXXX XXXX XXXX"
                    value={aadhaar}
                    disabled={otpVerified || otpSent}
                    onChange={(e) => setAadhaar(formatAadhaar(e.target.value))}
                  />
                  <button
                    type="button"
                    className="mv-input-toggle"
                    onClick={() => setShowMask(!showMask)}
                  >
                    {showMask ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {!otpSent && !otpVerified && (
                  <button
                    type="button"
                    className="mv-btn-primary"
                    disabled={aadhaar.replace(/\s/g, '').length !== 12 || loading}
                    onClick={handleSendOtp}
                  >
                    {loading ? 'Sending OTP…' : 'Send OTP'} <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* OTP Sub-block */}
              {otpSent && !otpVerified && (
                <div className="mv-form-section">
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
                    disabled={!isOtpComplete}
                    onClick={handleVerifyOtpLocal}
                  >
                    Verify OTP & Continue <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* Step 2: Personal Details */}
              <div className={`mv-form-section ${!otpVerified ? 'dimmed' : ''}`}>
                <label className="mv-form-label">Personal Information</label>
                <div className="mv-form-grid-2">
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="First Name *"
                      disabled={!otpVerified}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="Last Name"
                      disabled={!otpVerified}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mv-form-grid-2">
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="10-digit Mobile *"
                      disabled={!otpVerified}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </div>
                  <div className="mv-input-group">
                    <input
                      type="date"
                      className="mv-input"
                      disabled={!otpVerified}
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mv-form-grid-2">
                  <div className="mv-input-group">
                    <select
                      className="mv-input"
                      disabled={!otpVerified}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="City / Pincode"
                      disabled={!otpVerified}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>

                {step === 2 && (
                  <button
                    type="button"
                    className="mv-btn-primary"
                    disabled={!firstName.trim() || !/^[6-9]\d{9}$/.test(mobile) || !dob}
                    onClick={() => {
                      if (!/^[6-9]\d{9}$/.test(mobile)) {
                        setError('Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
                        return;
                      }
                      setError('');
                      setStep(3);
                    }}
                  >
                    Next: Contact Details <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* Step 3: Emergency Contact */}
              <div className={`mv-form-section ${step < 3 ? 'dimmed' : ''}`}>
                <label className="mv-form-label">Emergency Contact (Optional)</label>
                <div className="mv-form-grid-2">
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="Contact Name"
                      disabled={step < 3}
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="mv-input-group">
                    <input
                      type="text"
                      className="mv-input"
                      placeholder="Contact Phone"
                      disabled={step < 3}
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </div>
                </div>

                {step === 3 && (
                  <button
                    type="button"
                    className="mv-btn-primary"
                    disabled={loading}
                    onClick={handleRegisterSubmit}
                  >
                    {loading ? 'Creating Profile…' : 'Create Account'} <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </form>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <Link to="/login" style={{ color: 'var(--mv-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back to Login
            </Link>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--mv-text-muted)' }}>
              <Shield size={14} color="#1A8C7A" /> Protected by ABDM Guidelines
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
