import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../userPages.css";
import { userApi, readLocalJSON } from "../services/userApi";
import { onDatabaseChange } from "../services/realtime";
import { useDashboardLanguage } from "../LanguageContext";
import PatientSidebar from "../components/asidebar";
import ChatbotFAB from "../components/ChatbotFAB";
import DoctorActivityBell from "../components/DoctorActivityBell";
import BrandLogo from "../../../shared/BrandLogo";


import {
  Camera,
  CalendarDays,
  CircleCheck,
  Nut,
  Shell,
  Flower2,
  LogOut,
  Pencil,
  CircleUser,
  ChevronsRight,
  Copy,
  Check,
  Shield,
  Activity,
  FileText,
  FileCheck,
  BookOpen,
  Bot,
  HeartPulse,
  Stethoscope,
  Sparkles,
  Lock,
  Building2,
   TriangleAlert
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useDashboardLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [dashboard, setDashboard] = useState(null);
  const [accessRequests, setAccessRequests] = useState([]);
  const [copiedAbha, setCopiedAbha] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time dashboard updates via MongoDB change stream & socket
  useEffect(() => {
    const loadDashboard = () =>
      userApi
        .dashboard()
        .then(setDashboard)
        .catch(() => setDashboard(null));

    loadDashboard();
    return onDatabaseChange(loadDashboard);
  }, []);

  // Poll and listen for doctor access requests
  const loadAccessRequests = () => {
    userApi
      .getAccessRequests()
      .then((res) => setAccessRequests(res || []))
      .catch(() => setAccessRequests([]));
  };

  useEffect(() => {
    loadAccessRequests();
    const interval = setInterval(loadAccessRequests, 4000);
    const off = onDatabaseChange(loadAccessRequests);
    return () => {
      clearInterval(interval);
      if (off) off();
    };
  }, []);

  const handleRespond = async (id, status) => {
    try {
      await userApi.respondAccessRequest(id, status);
      loadAccessRequests();
    } catch (err) {
      console.error("Failed to respond to consent request:", err);
    }
  };

  const pendingRequests = accessRequests.filter((r) => r.status === "pending");

  const profile = dashboard?.profile;
  const storedUser = readLocalJSON("user_profile", {});
  const patientName =
    profile?.name?.trim() ||
    (storedUser?.firstName
      ? `${storedUser.firstName} ${storedUser.lastName || ""}`.trim()
      : "") ||
    dashboard?.abha?.name?.trim() ||
    (dashboard ? "Patient" : "Loading profile…");

  const initials = (patientName.replace(/[^a-zA-Z\s]/g, "").trim() || "PT")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const getVal = (primary, ...fallbacks) => {
    if (primary && String(primary).trim() && String(primary).trim() !== "—")
      return String(primary).trim();
    for (const fb of fallbacks) {
      if (fb && String(fb).trim() && String(fb).trim() !== "—")
        return String(fb).trim();
    }
    return "—";
  };

  const abhaNumber = getVal(
    dashboard?.abha?.number,
    storedUser?.abhaNumber,
    storedUser?.ABHANumber
  );

  const handleCopyAbha = (e) => {
    e.stopPropagation();
    if (abhaNumber && abhaNumber !== "—") {
      navigator.clipboard.writeText(abhaNumber);
      setCopiedAbha(true);
      setTimeout(() => setCopiedAbha(false), 2000);
    }
  };

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };



  // Core Clinical Hub destinations
  const clinicalHub = [
    {
      title: "SOCRATES Intake Form",
      badge: "Voice Enabled",
      desc: "10-point pain & symptom clinical evaluation with speech recognition in 4 languages",
      path: "/socrates",
      icon: Stethoscope,
      accent: "#2F8F83",
      tags: ["Voice Listen & Speak", "10-Point Analysis", "Pain Scale (0-10)"],
    },
    {
      title: "Medical Directory",
      badge: "AYUSH & WHO",
      desc: "Instant search for WHO ICD-11 diagnostics and AYUSH NAMASTE clinical terms",
      path: "/kindle",
      icon: BookOpen,
      accent: "#12304A",
      tags: ["ICD-11 Lookup", "NAMASTE Ayush", "Clinical Registry"],
    },
    {
      title: "Medical Records & Docs",
      badge: "Secure Vault",
      desc: "Upload, categorize, and review clinical prescriptions, lab reports, and summaries",
      path: "/uploadDoc",
      icon: FileText,
      accent: "#0284C7",
      tags: ["Prescriptions", "Diagnostic Labs", "Discharge Summaries"],
    },
    {
      title: "ABDM Consent Manager",
      badge: pendingRequests.length > 0 ? `${pendingRequests.length} Pending` : "NDHM Standard",
      badgeColor: pendingRequests.length > 0 ? "#DC2626" : undefined,
      desc: "Review and grant consent to doctors and hospitals for viewing your health data",
      path: "/consent",
      icon: FileCheck,
      accent: "#0D9488",
      tags: ["Consent Artifacts", "Doctor Requests", "Access Logs"],
    },
    {
      title: "AI Medical Assistant",
      badge: "24/7 Triage",
      desc: "Gentle triage assistant with speech synthesis and voice-to-voice consultation",
      path: "/genai",
      icon: Bot,
      accent: "#7C3AED",
      tags: ["Voice-to-Voice", "Bilingual EN/HI", "Instant Guidance"],
    },
    {
      title: "Official ABHA Smart Card",
      badge: "Govt of India",
      desc: "Ayushman Bharat Health Account card with scannable QR and instant PDF download",
      path: "/abha",
      icon: Shield,
      accent: "#16A34A",
      tags: ["NHA Standard", "Scannable QR", "Download Card"],
    },
    {
      title: "Nearby Hospitals",
      badge: "Emergency",
      badgeColor: "#DC2626",
      desc: "Find nearest hospitals, clinics, and emergency services with live driving times",
      path: "/nearby-hospitals",
      icon: Building2,
      accent: "#DC2626",
      tags: ["Live GPS", "Driving Times", "Emergency Hotlines"],
    },
  ];

  const photoSrc =
    profile?.photoUrl ||
    profile?.photo ||
    storedUser?.photoUrl ||
    storedUser?.photo;

  return (
    <div className="sih-page-wrapper" style={{ minHeight: "100vh", backgroundColor: "var(--mint-bg, #F5FAF8)" }}>
      {/* ===== GLOBAL HEADER ===== */}
      <header className="sih-header">
        <div className="sih-header-inner">
          <BrandLogo subtitle="Health Portal" />

          <div className="sih-header-controls">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="sih-lang-select"
              data-no-translate
              translate="no"
              aria-label="Language selector"
            >
              <option value="English">🌐 English</option>
              <option value="Hindi">🌐 हिंदी</option>
              <option value="Bengali">🌐 বাংলা</option>
              <option value="Tamil">🌐 தமிழ்</option>
            </select>

            {/* Doctor activity bell */}
            <DoctorActivityBell />

            {/* Profile trigger */}
            <div className="sih-profile-wrapper" ref={profileRef}>
              <button
                type="button"
                className="sih-profile-trigger"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                <div className="sih-profile-avatar" style={{ overflow: "hidden" }}>
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt="DP"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <span className="sih-profile-name">{patientName}</span>
                <span className={`sih-profile-chevron ${profileOpen ? "open" : ""}`}>▾</span>
              </button>

              {profileOpen && (
                <div className="sih-profile-dropdown" role="menu">
                  <button
                    type="button"
                    className="sih-profile-dropdown-item"
                    onClick={() => {
                      navigate("/profile");
                      setProfileOpen(false);
                    }}
                  >
                    <span className="dd-icon"><CircleUser size={18} /></span> Profile Overview
                  </button>
                  <button
                    type="button"
                    className="sih-profile-dropdown-item"
                    onClick={() => {
                      navigate("/basicInfo");
                      setProfileOpen(false);
                    }}
                  >
                    <span className="dd-icon"><Pencil size={18} /></span> Edit Details
                  </button>
                  <button
                    type="button"
                    className="sih-profile-dropdown-item danger"
                    onClick={() => {
                      localStorage.removeItem("token");
                      localStorage.removeItem("user_profile");
                      setProfileOpen(false);
                      navigate("/login");
                    }}
                  >
                    <span className="dd-icon"><LogOut size={18} /></span> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== PATIENT MAIN CONTAINER ===== */}
      <div className="patient-main-container">
        <PatientSidebar
          profile={profile}
          storedUser={storedUser}
          patientName={patientName}
          initials={initials}
          activePage="dashboard"
        />

        <div className="patient-content-area">
          <main className="sih-main-layout" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* ─── COMPACT PATIENT PROFILE HEADER CARD ─── */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "1rem 1.25rem",
                border: "1px solid var(--border-light, #E2E8F0)",
                boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2F8F83 0%, #12304A 100%)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {photoSrc ? (
                    <img src={photoSrc} alt={patientName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{patientName}</span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        background: "#ECFDF5",
                        color: "#059669",
                        fontWeight: 600,
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      ABDM Verified
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: "2px", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    {abhaNumber && abhaNumber !== "—" && (
                      <span
                        onClick={handleCopyAbha}
                        title="Click to copy ABHA Number"
                        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", color: "#0D9488", fontWeight: 600 }}
                      >
                        ABHA: {abhaNumber}
                        {copiedAbha ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                      </span>
                    )}
                    <span>DOB: {getVal(profile?.dob, storedUser?.dob)}</span>
                    <span>Gender: {getVal(profile?.gender, storedUser?.gender)}</span>
                    <span>Blood Group: {getVal(profile?.bloodGroup, storedUser?.bloodGroup)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/profile")}
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  padding: "0.4rem 0.85rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <Pencil size={14} /> View Full Profile
              </button>
            </div>


            {/* ─── 5. ALLERGIES & VACCINATION PILLS ─── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem",
              }}
              className="lp-responsive-split"
            >
              {/* Allergies Card */}
              <div
                role="button"
                tabIndex={0}
                aria-label="View or edit known allergies"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "18px",
                  border: "1px solid var(--border-light, #E2E8F0)",
                  padding: "1.25rem 1.5rem",
                  boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => navigate("/basicInfo")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate("/basicInfo");
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#FEF2F2",
                        color: "#EF4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                       <TriangleAlert size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-navy, #12304A)", margin: 0 }}>
                        Known Allergies
                      </h3>
                      <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--text-muted, #64748B)" }}>
                        Documented reactions & drug sensitivities
                      </p>
                    </div>
                  </div>
                  <ChevronsRight size={18} color="var(--text-muted, #64748B)" />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {(Array.isArray(profile?.allergies) && profile.allergies.length > 0
                    ? profile.allergies
                    : typeof profile?.allergies === "string" && profile.allergies.trim() !== ""
                    ? profile.allergies.split(",").map((a) => a.trim())
                    : ["Peanut Sensitivity", "Penicillin Allergy", "Pollen Allergy"]
                  ).map((allergy, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "#FFF1F2",
                        color: "#E11D48",
                        borderRadius: "8px",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "1px solid #FECDD3",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem" }}>
                        {[<Nut size={14} key="n" />, <Shell size={14} key="s" />, <Flower2 size={14} key="f" />][idx % 3]}
                      </span>
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>

              {/* Vaccinations Card */}
              <div
                role="button"
                tabIndex={0}
                aria-label="View or edit vaccination history"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "18px",
                  border: "1px solid var(--border-light, #E2E8F0)",
                  padding: "1.25rem 1.5rem",
                  boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => navigate("/basicInfo")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate("/basicInfo");
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CircleCheck size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-navy, #12304A)", margin: 0 }}>
                        Vaccination History
                      </h3>
                      <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--text-muted, #64748B)" }}>
                        Verified immunizations on record
                      </p>
                    </div>
                  </div>
                  <ChevronsRight size={18} color="var(--text-muted, #64748B)" />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {[
                    { name: "COVID-19 (Covishield)", date: "Mar 2023" },
                    { name: "Hepatitis B", date: "Jan 2023" },
                    { name: "Tetanus Toxoid", date: "Nov 2022" },
                  ].map((vac, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "#ECFDF5",
                        color: "var(--primary-navy, #12304A)",
                        borderRadius: "8px",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      <CircleCheck size={14} color="#10B981" />
                      <span>
                        {vac.name}{" "}
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted, #64748B)", fontWeight: 600 }}>
                          ({vac.date})
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── 6. CLINICAL & HEALTH TOOLS ACTION HUB (6-CARD GRID) ─── */}
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--teal-primary, #2F8F83)",
                  }}
                >
                  Clinical Services & Modules
                </span>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "var(--primary-navy, #12304A)",
                    margin: "0.15rem 0 0",
                  }}
                >
                  Health Operating System Hub
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "1.25rem",
                }}
              >
                {clinicalHub.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${card.title}`}
                      onClick={() => navigate(card.path)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(card.path);
                        }
                      }}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: "18px",
                        border: "1px solid var(--border-light, #E2E8F0)",
                        padding: "1.5rem",
                        cursor: "pointer",
                        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow = "var(--shadow-md, 0 6px 20px rgba(18, 48, 74, 0.08))";
                        e.currentTarget.style.borderColor = "var(--teal-primary, #2F8F83)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05))";
                        e.currentTarget.style.borderColor = "var(--border-light, #E2E8F0)";
                      }}
                    >
                      <div>
                        {/* Header: Icon + Badge */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "1rem",
                          }}
                        >
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "14px",
                              background: `${card.accent}14`,
                              color: card.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon size={24} strokeWidth={2.2} />
                          </div>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              background: card.badgeColor ? "#FEF2F2" : "#F1F5F9",
                              color: card.badgeColor || card.accent,
                              padding: "0.3rem 0.7rem",
                              borderRadius: "999px",
                              border: `1px solid ${card.badgeColor ? "#FECDD3" : "#E2E8F0"}`,
                            }}
                          >
                            {card.badge}
                          </span>
                        </div>

                        {/* Title & Desc */}
                        <h3
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 800,
                            color: "var(--primary-navy, #12304A)",
                            margin: 0,
                          }}
                        >
                          {card.title}
                        </h3>
                        <p
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted, #64748B)",
                            margin: "0.4rem 0 1rem",
                            lineHeight: 1.45,
                          }}
                        >
                          {card.desc}
                        </p>
                      </div>

                      {/* Feature Tags & Arrow */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid #F1F5F9",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {card.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                background: "#F8FAFC",
                                color: "var(--text-main, #183B56)",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "6px",
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <ChevronsRight size={18} color={card.accent} strokeWidth={2.5} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── 7. FOOTER SECURITY NOTICE ─── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "1rem",
                color: "var(--text-muted, #64748B)",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <Lock size={14} color="var(--teal-primary, #2F8F83)" />
              <span>
                256-bit Encrypted Health Portal • National Health Authority (NHA) & Ayushman Bharat Digital Mission (ABDM) Compliant
              </span>
            </div>
          </main>
        </div>
      </div>

      {/* Floating Chatbot Assistant */}
      <ChatbotFAB />

      {/* Responsive adjustments */}
      <style>{`
        @media (max-width: 768px) {
          .lp-responsive-split {
            grid-template-columns: 1fr !important;
          }
          .landing-welcome-banner {
            padding: 1rem !important;
          }
          .patient-content-area {
            padding: 0.75rem !important;
          }
        }
        @media (max-width: 600px) {
          .lp-vitals-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 0.65rem !important;
          }
        }
        @media (max-width: 480px) {
          .sih-main-layout {
            gap: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
