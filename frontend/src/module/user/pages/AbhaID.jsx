import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../userPages.css';
import { userApi, readLocalJSON } from '../services/userApi';
import { onDatabaseChange } from '../services/realtime';
import { useDashboardLanguage } from '../LanguageContext';
import PatientSidebar from '../components/asidebar';
import ChatbotFAB from '../components/ChatbotFAB';
import DoctorActivityBell from '../components/DoctorActivityBell';
import BrandLogo from '../../../shared/BrandLogo';
import {
 Landmark, 
  Phone,
  CircleUser,
  LogOut,
  Pencil,Bell,BookOpen,Mail,
  Pill,
  TestTube,
  Calendar,
  Search,
  Download,
  Share2,
  Eye,
  FileText,
  Lock,
  Cloud,
  Contact,
  Folder
} from "lucide-react";

// Utility for formatting dates
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  } catch (e) {
    return dateString;
  }
};

export default function AbhaID() {
  const navigate = useNavigate();

  const [abhaDetails, setAbhaDetails] = useState({});
  const [pendingConsents, setPendingConsents] = useState([]);

  const { language, setLanguage } = useDashboardLanguage();
  const [toastMessage, setToastMessage] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const fetchData = () => {
      const storedProfile = readLocalJSON('user_profile', {});
      userApi.abha().then((data) => setAbhaDetails({
        ...data,
        name: data.name || storedProfile.fullName || (storedProfile.firstName ? `${storedProfile.firstName} ${storedProfile.lastName || ''}`.trim() : ''),
        number: data.number || storedProfile.abhaNumber || storedProfile.ABHANumber || 'N/A',
        abhaNumber: data.number || storedProfile.abhaNumber || storedProfile.ABHANumber || 'N/A',
        phrAddress: data.phrAddress || storedProfile.abhaAddress || storedProfile.phrAddress || 'N/A',
        dob: data.dob || storedProfile.dob || 'N/A',
        gender: data.gender === 'M' ? 'Male' : (data.gender === 'F' ? 'Female' : (data.gender || storedProfile.gender || 'N/A')),
        mobile: data.contact?.phone || storedProfile.mobile || storedProfile.phone || 'N/A',
        address: data.contact?.address || storedProfile.city || storedProfile.address || 'N/A',
        emergencyContact: data.contact?.emergencyContactName || storedProfile.emergencyContactName || 'Family Member',
        photoUrl: data.photoUrl || storedProfile.photoUrl || null,
      })).catch((error) => showNotification(error.message));
      userApi.consents().then((items) => setPendingConsents(items.filter((item) => item.status === 'pending'))).catch((error) => showNotification(error.message));
    };
    fetchData();
    return onDatabaseChange(fetchData);
  }, []);

  const handleDownload = () => {
    showNotification('Downloading official ABHA Health Card (PDF)...');
  };

  return (
    <div className="sih-page-wrapper">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="sih-toast">
          <svg className="sih-toast-icon" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
          <span className="sih-toast-text">{toastMessage}</span>
        </div>
      )}

      {/* TOP NAVBAR */}
      <header className="sih-header">
        <div className="sih-header-inner">
          <BrandLogo subtitle="Health Portal" />


          <div className="sih-header-controls">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="sih-lang-select" data-no-translate translate="no">
              <option value="English">🌐 English</option>
              <option value="Hindi">🌐 हिंदी</option>
              <option value="Bengali">🌐 বাংলা</option>
              <option value="Tamil">🌐 தமிழ்</option>
            </select>
            <DoctorActivityBell />
            <div className="sih-profile-wrapper" ref={profileRef}>
              <button className="sih-profile-trigger" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="sih-profile-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                  {abhaDetails.photoUrl ? (
                    <img src={abhaDetails.photoUrl} alt="DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (abhaDetails.name || 'Patient').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'
                  )}
                </div>
                <span className="sih-profile-name">{abhaDetails.name || 'Profile'}</span>
                <span className={`sih-profile-chevron ${profileOpen ? 'open' : ''}`}>▾</span>
              </button>
              {profileOpen && (
                <div className="sih-profile-dropdown">
                  <button className="sih-profile-dropdown-item" onClick={() => { navigate('/profile'); setProfileOpen(false); }}>
                    <span className="dd-icon"><CircleUser /> </span> Profile
                  </button>
                  <button className="sih-profile-dropdown-item danger" onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_profile');
                    setProfileOpen(false);
                    navigate('/login');
                  }}>
                    <span className="dd-icon"><LogOut /></span> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="patient-main-container">
        <PatientSidebar profile={abhaDetails} patientName={abhaDetails.name} activePage="abha" />
        <div className="patient-content-area">
          {/* MAIN CONTAINER */}
          <main className="sih-main-layout">

        {/* FULL-WIDTH LAYOUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ABHA ID CARD — FULL WIDTH */}
          <div>
            
            {/* OFFICIAL ABHA ID CARD */}
            <div className="sih-card">
              
              {/* Official NHA Header Strip */}
              <div className="abha-nha-banner">
                <div className="abha-nha-left">
                  <div className="abha-nha-icon">
                    <Landmark size={22} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', opacity: 0.8 }}>
                      National Health Authority • Govt. of India
                    </p>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Ayushman Bharat Health Account (ABHA)</h2>
                  </div>
                </div>

                <span className="sih-badge sih-badge-teal">
                  {abhaDetails.verificationStatus}
                </span>
              </div>

              {/* Card Body */}
              <div className="abha-card-body">
                
                <div className="abha-card-main-row">
                  
                  {/* Photo & Main Demographics */}
                  <div className="abha-user-profile">
                    <div className="abha-avatar-box" style={{ overflow: 'hidden', padding: 0 }}>
                      {abhaDetails.photoUrl ? (
                        <img src={abhaDetails.photoUrl} alt={abhaDetails.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (abhaDetails.name || 'Patient').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-navy)', margin: 0 }}>{abhaDetails.name}</h3>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
                        {abhaDetails.gender} • DOB: {formatDate(abhaDetails.dob)}
                      </p>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
                        Blood Group: <span style={{ color: 'var(--teal-primary)', fontWeight: 900 }}>{abhaDetails.bloodGroup}</span>
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                        Mobile: <strong style={{ color: 'var(--primary-navy)' }}>{abhaDetails.mobile}</strong>
                      </p>
                    </div>
                  </div>

                  {/* QR Code Box */}
                  <div className="abha-qr-wrapper">
                    <div className="abha-qr-inner">
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#2F8F83' }}></div>
                      <div className="abha-qr-cell" style={{ backgroundColor: '#12304A' }}></div>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-navy)', display: 'block', marginTop: '0.4rem' }}>
                      Scan QR Code
                    </span>
                  </div>

                </div>

                <div className="abha-key-details-grid">
                  <div className="abha-number-box">
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>ABHA Health Number</p>
                    <p style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--primary-navy)', marginTop: '0.2rem', margin: 0 }}>{abhaDetails.abhaNumber}</p>
                  </div>

                  <div className="abha-phr-box">
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>PHR / ABHA Address</p>
                    <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--teal-primary)', marginTop: '0.2rem', margin: 0 }}>{abhaDetails.phrAddress}</p>
                  </div>
                </div>

                {/* Additional Info Footer */}
                <div className="abha-card-footer">
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--mint-light)', margin: 0, fontSize: '0.8rem' }}>Emergency Contact:</p>
                    <p style={{ color: '#CBD5E1', fontWeight: 600, fontSize: '0.75rem', margin: 0 }}>{abhaDetails.emergencyContact}</p>
                  </div>
                  <span className="sih-badge sih-badge-teal">
                    ABDM Compliant Card
                  </span>
                </div>

              </div>

            </div>

          </div>

          {/* DOWNLOAD BUTTON — FULL WIDTH BELOW */}
          <div>
            <button
              onClick={handleDownload}
              className="sih-btn sih-btn-primary"
              style={{ width: '100%', padding: '1rem 1.5rem', fontSize: '0.95rem', borderRadius: 'var(--radius-xl)' }}
            >
              <span><Download size={22} /></span> Download Official ABHA Card (PDF)
            </button>
          </div>

        </div>

      </main>
        </div>
      </div>

      <ChatbotFAB />
    </div>
  );
}
