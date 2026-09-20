import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../userPages.css';
import { userApi } from '../services/userApi';
import { onDatabaseChange } from '../services/realtime';
import { useDashboardLanguage } from '../LanguageContext';
import PatientSidebar from '../components/asidebar';
import ChatbotFAB from '../components/ChatbotFAB';
import DoctorActivityBell from '../components/DoctorActivityBell';
import BrandLogo from '../../../shared/BrandLogo';

import {
  FileText,
 Landmark, 
  CircleUser,
  LockKeyhole,
  LogOut,
  Phone,
  Pencil,BookOpen,Mail,
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
  Folder
} from "lucide-react";
// Formatting Utilities
export const formatDate = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  } catch (e) {
    return dateString;
  }
};

export default function Consent() {
  const navigate = useNavigate();

  const [consents, setConsents] = useState([]);

  // State Management
  const [activeStatus, setActiveStatus] = useState('accepted');
  const [searchQuery, setSearchQuery] = useState('');
  const { language, setLanguage } = useDashboardLanguage();
  const [toastMessage, setToastMessage] = useState(null);
  const [selectedConsent, setSelectedConsent] = useState(null);
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

  // Toast Notification Helper
  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const fetchConsents = async () => {
      try {
        const [genericConsents, docRequests] = await Promise.all([
          userApi.consents().catch(() => []),
          userApi.getAccessRequests().catch(() => []),
        ]);

        const mappedGeneric = (genericConsents || []).map((item) => ({
          ...item,
          title: item.purpose,
          date: item.requestedAt,
          expiry: item.respondedAt || 'N/A',
          scope: [item.purpose],
        }));

        const mappedDocRequests = (docRequests || []).map((item) => ({
          id: item._id,
          isDoctorRequest: true,
          requester: item.doctorName || 'Doctor',
          purpose: `SOCRATES Form Access (${item.formInfo?.site || 'Pain Assessment'})`,
          status: item.status,
          requestedAt: item.requestedAt,
          respondedAt: item.respondedAt || 'N/A',
          title: `SOCRATES Form Access (${item.formInfo?.site || 'Pain Assessment'})`,
          date: item.requestedAt,
          expiry: item.respondedAt || 'N/A',
          scope: [
            `SOCRATES Assessment: ${item.formInfo?.site || 'Pain'}`,
            `Pain Severity: ${item.formInfo?.severity ?? 'N/A'}/10`,
          ],
        }));

        setConsents([...mappedDocRequests, ...mappedGeneric]);
      } catch (error) {
        showNotification(error.message);
      }
    };
    fetchConsents();
    return onDatabaseChange(fetchConsents);
  }, []);

  // Status Action Handlers
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const target = consents.find((c) => c.id === id);
      if (target?.isDoctorRequest) {
        await userApi.respondAccessRequest(id, newStatus);
      } else {
        await userApi.setConsentStatus(id, newStatus);
      }
      setConsents((previous) =>
        previous.map((consent) =>
          consent.id === id ? { ...consent, status: newStatus } : consent
        )
      );
      setSelectedConsent(null);
      showNotification(`Consent request ${newStatus.toUpperCase()} successfully.`);
    } catch (error) {
      showNotification(error.message);
    }
  };

  // Filtering Logic
  const filteredConsents = consents.filter(consent => {
    const matchesStatus = activeStatus === 'all' || consent.status === activeStatus;
    const matchesSearch = consent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          consent.requester.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Category counts
  const countAccepted = consents.filter(c => c.status === 'accepted').length;
  const countPending = consents.filter(c => c.status === 'pending').length;
  const countRejected = consents.filter(c => c.status === 'rejected').length;

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

      {/* TOP NAVIGATION BAR */}
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
                <div className="sih-profile-avatar">
                  {(() => {
                    const storedUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
                    const pName = storedUser.fullName || (storedUser.firstName ? `${storedUser.firstName} ${storedUser.lastName || ''}`.trim() : '');
                    return (pName && pName !== "Patient" ? pName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "PT");
                  })()}
                </div>
                <span className="sih-profile-name">
                  {(() => {
                    const storedUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
                    const fullName = storedUser.fullName || (storedUser.firstName ? `${storedUser.firstName} ${storedUser.lastName || ''}`.trim() : '');
                    return fullName ? fullName.split(' ')[0] : 'Profile';
                  })()}
                </span>
                <span className={`sih-profile-chevron ${profileOpen ? 'open' : ''}`}>▾</span>
              </button>
              {profileOpen && (
                <div className="sih-profile-dropdown">
                  <button className="sih-profile-dropdown-item" onClick={() => { navigate('/profile'); setProfileOpen(false); }}>
                    <span className="dd-icon"> <CircleUser /> </span> Profile
                  </button>
                  <button className="sih-profile-dropdown-item danger" onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_profile');
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
        <PatientSidebar activePage="consent" />
        <div className="patient-content-area">
      <main className="sih-main-layout">

        {/* CONSENTS MAIN HEADING CONTAINER */}
        <div className="sih-card consent-hero">
          <div className="consent-hero-text">
            <h2 className="consent-hero-title">Consents</h2>
            <p className="consent-hero-sub">
              Manage patient data access permissions, consent requests, and authorization records.
            </p>
          </div>

          <div className="consent-badges">
            <span className="sih-badge sih-badge-teal">
              Active: {countAccepted}
            </span>
            <span className="sih-badge sih-badge-amber">
              Pending: {countPending}
            </span>
            <span className="sih-badge sih-badge-red">
              Rejected: {countRejected}
            </span>
          </div>
        </div>

        {/* CATEGORIES (LEFT) + RECORDS (RIGHT) */}
        <div className="consent-layout">

        {/* STATUS CATEGORIES — left sidebar */}
        <div className="sih-card consent-cats-card">
          <p className="consent-cats-label">
            Categories
          </p>
          <div className="consent-cats">
          <button
            onClick={() => setActiveStatus('all')}
            className={`tab-nav-btn consent-cat-btn ${activeStatus === 'all' ? 'active' : ''}`}
          >
            <span className="consent-cat-name">All Records</span>
            <span className="consent-cat-count consent-cat-count-all">
              {consents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveStatus('accepted')}
            className={`tab-nav-btn consent-cat-btn ${activeStatus === 'accepted' ? 'active' : ''}`}
          >
            <span className="consent-dot" style={{ backgroundColor: '#10B981' }}></span>
            <span className="consent-cat-name">Accepted</span>
            <span className="consent-cat-count consent-cat-count-accepted">
              {countAccepted}
            </span>
          </button>

          <button
            onClick={() => setActiveStatus('pending')}
            className={`tab-nav-btn consent-cat-btn ${activeStatus === 'pending' ? 'active' : ''}`}
          >
            <span className="consent-dot" style={{ backgroundColor: '#F59E0B' }}></span>
            <span className="consent-cat-name">Pending</span>
            <span className="consent-cat-count consent-cat-count-pending">
              {countPending}
            </span>
          </button>

          <button
            onClick={() => setActiveStatus('rejected')}
            className={`tab-nav-btn consent-cat-btn ${activeStatus === 'rejected' ? 'active' : ''}`}
          >
            <span className="consent-dot" style={{ backgroundColor: '#EF4444' }}></span>
            <span className="consent-cat-name">Rejected</span>
            <span className="consent-cat-count consent-cat-count-rejected">
              {countRejected}
            </span>
          </button>
          </div>
        </div>

        {/* CONSENT RECORDS — right side */}
        <div className="sih-card consent-records-card">
          
          {/* Panel Sub-header */}
          <div className="consent-panel-head">
            <h3 className="consent-panel-title">
              <span className="consent-panel-dot"></span>
              Consent Records ({filteredConsents.length})
            </h3>
            <span className="consent-panel-showing">
              Showing: <strong className="consent-panel-status">{activeStatus}</strong>
            </span>
          </div>

          {/* CONSENT RECORDS LIST */}
          {filteredConsents.length > 0 ? (
            <div className="consent-records-list">
              {filteredConsents.map((consent) => (
                <div
                  key={consent.id}
                  className="consent-record-card"
                >
                  <div className="consent-record-top">
                    <div className="consent-record-id">
                      <div className="consent-record-title-row">
                        <h4 className="consent-record-title">
                          {consent.title}
                        </h4>

                        <span className={`sih-badge ${
                          consent.status === 'accepted'
                            ? 'sih-badge-teal'
                            : consent.status === 'pending'
                            ? 'sih-badge-amber'
                            : 'sih-badge-red'
                        }`}>
                          ● {consent.status}
                        </span>
                      </div>

                      <p className="consent-record-requester">
                        Requested by: <strong className="consent-record-requester-name">{consent.requester}</strong>
                      </p>
                    </div>

                    <div className="consent-record-dates">
                      <p className="consent-record-date">Requested: {formatDate(consent.date)}</p>
                      <p className="consent-record-expiry">Expiry: {formatDate(consent.expiry)}</p>
                    </div>
                  </div>

                  <p className="consent-record-purpose">
                    {consent.purpose}
                  </p>

                  {/* Scope & Actions */}
                  <div className="consent-record-foot">
                    <div className="scope-pills-wrap consent-scope">
                      <span className="consent-scope-label">Scope:</span>
                      {consent.scope.map((scp, idx) => (
                        <span key={idx} className="scope-pill-tag">
                          {scp}
                        </span>
                      ))}
                    </div>

                    <div className="consent-record-actions">
                      <button
                        onClick={() => setSelectedConsent(consent)}
                        className="sih-btn sih-btn-navy consent-action-btn"
                      >
                        Details
                      </button>

                      {consent.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(consent.id, 'accepted')}
                            className="sih-btn sih-btn-primary consent-action-btn"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(consent.id, 'rejected')}
                            className="sih-btn sih-btn-danger consent-action-btn"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {consent.status === 'accepted' && (
                        <button
                          onClick={() => handleUpdateStatus(consent.id, 'rejected')}
                          className="sih-btn sih-btn-outline consent-action-btn consent-revoke-btn"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="consent-empty">
              <div className="consent-empty-icon"><LockKeyhole /></div>
              <h4 className="consent-empty-title">No Consent Records Found</h4>
              <p className="consent-empty-text">
                No patient consent entries match the selected status <strong className="consent-empty-status">"{activeStatus}"</strong>.
              </p>
              <button
                onClick={() => { setActiveStatus('all'); setSearchQuery(''); }}
                className="sih-btn sih-btn-primary consent-empty-btn"
              >
                View All Consents
              </button>
            </div>
          )}

        </div>
        </div>

      </main>

      {/* CONSENT DETAILS MODAL */}
      {selectedConsent && (
        <div className="sih-modal-backdrop">
          <div className="sih-modal-card">
            
            <div className="sih-modal-header">
              <div>
                <span className="sih-badge sih-badge-teal">
                  {selectedConsent.status}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.25rem 0 0 0' }}>{selectedConsent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedConsent(null)}
                style={{ color: 'white', fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="sih-modal-body">
              <div style={{ backgroundColor: 'var(--mint-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Requester / Organization</p>
                  <p style={{ fontWeight: 800, color: 'var(--primary-navy)', fontSize: '0.9rem', margin: '0.1rem 0 0 0' }}>{selectedConsent.requester}</p>
                </div>

                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Detailed Purpose</p>
                  <p style={{ color: 'var(--text-main)', marginTop: '0.1rem', margin: 0 }}>{selectedConsent.purpose}</p>
                </div>

                <div className="consent-modal-dates">
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Granted Date</p>
                    <p style={{ fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>{formatDate(selectedConsent.date)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Expiration Date</p>
                    <p style={{ fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>{formatDate(selectedConsent.expiry)}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                {selectedConsent.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedConsent.id, 'accepted')}
                      className="sih-btn sih-btn-primary"
                    >
                      Grant Consent
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedConsent.id, 'rejected')}
                      className="sih-btn sih-btn-danger"
                    >
                      Reject Consent
                    </button>
                  </>
                )}
                {selectedConsent.status === 'accepted' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedConsent.id, 'rejected')}
                    className="sih-btn sih-btn-danger"
                  >
                    Revoke Consent
                  </button>
                )}
                <button
                  onClick={() => setSelectedConsent(null)}
                  className="sih-btn sih-btn-outline"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

        </div>
      </div>

      <ChatbotFAB />
    </div>
  );
}
