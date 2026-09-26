import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../userPages.css';
import { userApi, readLocalJSON } from '../services/userApi';
import { onDatabaseChange } from '../services/realtime';
import PatientSidebar from '../components/asidebar';
import { useDashboardLanguage } from '../LanguageContext';
import ChatbotFAB from '../components/ChatbotFAB';
import DoctorActivityBell from '../components/DoctorActivityBell';
import BrandLogo from '../../../shared/BrandLogo';
import {
  FileText,
  RefreshCw,
  ClipboardClock,
  ClipboardList,
FilePenLine,
 Landmark, 
  Phone,
  Pencil,Bell,BookOpen,Mail,
  Pill,
  TestTube,
  Calendar,
  Search,
  Download,
  Share2,
  Eye,
 Trash2,
  Lock,
  Cloud,
  Contact,
  Folder,
  Leaf,
  Globe,
  FolderLock,
   CircleUser,
  LogOut,
} from "lucide-react";


export default function ProfilePage() {
  const navigate = useNavigate();

  const [patientProfile, setPatientProfile] = useState({});

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
    const fetchProfileData = () => {
      const storedProfile = readLocalJSON('user_profile', {});
      const profilePromise = storedProfile.id ? userApi.getUserById(storedProfile.id) : userApi.profile();
      Promise.all([profilePromise, userApi.abha().catch(() => ({}))]).then(([profile, abha]) => {
        setPatientProfile({
          name: profile.fullName || profile.name || storedProfile.fullName || (storedProfile.firstName ? `${storedProfile.firstName} ${storedProfile.lastName || ''}`.trim() : '') || 'User',
          abhaNumber: abha.number || profile.abhaNumber || profile.ABHANumber || storedProfile.abhaNumber || storedProfile.ABHANumber || 'N/A',
          phrAddress: abha.phrAddress || profile.phrAddress || storedProfile.abhaAddress || storedProfile.phrAddress || 'N/A',
          dob: profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN') : (profile.dob || storedProfile.dob || 'N/A'),
          gender: profile.gender === 'M' ? 'Male' : (profile.gender === 'F' ? 'Female' : (profile.gender || storedProfile.gender || 'N/A')),
          bloodGroup: profile.bloodGroup || storedProfile.bloodGroup || 'N/A',
          mobile: profile.phone || profile.mobile || profile.contact?.phone || storedProfile.mobile || storedProfile.phone || 'N/A',
          email: profile.email || profile.contact?.email || storedProfile.email || 'N/A',
          emergencyContact: profile.contact?.emergencyContactName || storedProfile.emergencyContactName || 'Family Member',
          address: profile.address || profile.contact?.address || storedProfile.city || storedProfile.address || 'N/A',
          abhaStatus: abha.verificationStatus || storedProfile.abhaStatus || 'Verified',
          photoUrl: profile.photoUrl || profile.photo || storedProfile.photoUrl || null,
        });
      }).catch((error) => showNotification(error.message));
    };
    fetchProfileData();
    return onDatabaseChange(fetchProfileData);
  }, []);

  return (
    <div className="sih-page-wrapper">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="sih-toast">
          <svg className="sih-toast-icon" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
          <span className="sih-toast-text">{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
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
                  {patientProfile.photoUrl ? (
                    <img src={patientProfile.photoUrl} alt="DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (patientProfile.name || 'Patient').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'
                  )}
                </div>
                <span className="sih-profile-name">{patientProfile.name || 'Profile'}</span>
                <span className={`sih-profile-chevron ${profileOpen ? 'open' : ''}`}>▾</span>
              </button>
              {profileOpen && (
                <div className="sih-profile-dropdown">
                  <button className="sih-profile-dropdown-item" onClick={() => { navigate('/profile'); setProfileOpen(false); }}>
                    <span className="dd-icon"><CircleUser /></span> Profile
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
        <PatientSidebar profile={patientProfile} patientName={patientProfile.name} activePage="profile" />
        <div className="patient-content-area">
          {/* MAIN CONTENT */}
          <main className="sih-main-layout">
        
        {/* HERO BANNER */}
        <div className="profile-hero-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div className="profile-avatar-large" style={{ overflow: 'hidden', padding: 0 }}>
              {patientProfile.photoUrl ? (
                <img src={patientProfile.photoUrl} alt="DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (patientProfile.name || 'Patient').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PT'
              )}
            </div>
            <div>
              <span className="sih-badge sih-badge-teal" style={{ marginBottom: '0.4rem' }}>
                ABDM Verified Patient
              </span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0.2rem 0' }}>{patientProfile.name}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--mint-light)', opacity: 0.9, margin: 0 }}>
                {patientProfile.gender} • 32 Years • Blood Group: <strong style={{ color: 'white' }}>{patientProfile.bloodGroup}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/basicInfo')}
              className="sih-btn sih-btn-primary"
            >
              Edit Information
            </button>
            <button
              onClick={() => showNotification('Exporting full EHR dossier...')}
              className="sih-btn sih-btn-outline"
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
            >
              Export EHR
            </button>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="profile-details-grid-section">
          
          {/* MAIN PROFILE DETAILS */}
          <div className="profile-info-block" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--primary-navy)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', margin: 0 }}>
              Demographic & Registration Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div className="profile-field-row">
                <span className="profile-field-label">ABHA Health Number:</span>
                <span className="profile-field-val" style={{ fontFamily: 'monospace' }}>{patientProfile.abhaNumber}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">PHR / ABHA Address:</span>
                <span className="profile-field-val" style={{ color: 'var(--teal-primary)' }}>{patientProfile.phrAddress}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Verification Status:</span>
                <span className="profile-field-val">{patientProfile.abhaStatus}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Primary Email:</span>
                <span className="profile-field-val">{patientProfile.email}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Mobile Number:</span>
                <span className="profile-field-val">{patientProfile.mobile}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Residential Address:</span>
                <span className="profile-field-val">{patientProfile.address}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Primary Care Hospital:</span>
                <span className="profile-field-val">{patientProfile.registeredHospital}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Attending Doctor:</span>
                <span className="profile-field-val">{patientProfile.primaryDoctor}</span>
              </div>

              <div className="profile-field-row">
                <span className="profile-field-label">Health Insurance:</span>
                <span className="profile-field-val">{patientProfile.insuranceProvider}</span>
              </div>
            </div>
          </div>

          {/* QUICK LINKS & EMERGENCY CONTACT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div className="profile-info-block" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', margin: 0 }}>
                Emergency Contact
              </h3>
              <p style={{ fontWeight: 800, color: 'var(--primary-navy)', fontSize: '0.95rem', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                {patientProfile.emergencyContact}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Designated immediate proxy for clinical emergency authorizations.
              </p>
            </div>

            <div className="profile-info-block" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--primary-navy)', textTransform: 'uppercase', margin: 0 }}>
                Quick Shortcuts
              </h3>

              <button onClick={() => navigate('/abha')} className="sih-btn sih-btn-outline" style={{ justifyContent: 'space-between' }}>
                <span><Contact size={20} /> View Official ABHA Card</span>
                <span>→</span>
              </button>

              <button onClick={() => navigate('/uploadDoc')} className="sih-btn sih-btn-outline" style={{ justifyContent: 'space-between' }}>
                <span><Folder size={22} /> Upload Medical Reports</span>
                <span>→</span>
              </button>

              <button onClick={() => navigate('/consent')} className="sih-btn sih-btn-outline" style={{ justifyContent: 'space-between' }}>
                <span><FolderLock size={20} /> Manage Consent Requests</span>
                <span>→</span>
              </button>
            </div>

          </div>

        </div>

          </main>
        </div>
      </div>

      <ChatbotFAB />
    </div>
  );
}
