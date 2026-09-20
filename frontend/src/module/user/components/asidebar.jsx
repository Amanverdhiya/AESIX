import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UserRound,
  Shield,
  FileText,
  FileCheck,
  ClipboardList,
  BookOpen,
  User,
  Bot,
  Sparkles,
  Building2,
} from "lucide-react";

const PatientSidebar = ({
  profile,
  storedUser,
  patientName,
  initials,
  activePage,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Every patient page shares this persisted identity. Individual pages often
  // load partial profile shapes, so they must not replace the signed-in name.
  const persistedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user_profile') || '{}'); } catch { return {}; }
  })();
  const identity = { ...persistedUser, ...(storedUser || {}) };
  const identityName = identity.fullName || identity.name ||
    `${identity.firstName || ''} ${identity.lastName || ''}`.trim();

  const pName =
    identityName ||
    patientName ||
    profile?.fullName ||
    profile?.name ||
    "Patient";

  const userInitials =
    initials ||
    (pName && pName !== "Patient"
      ? pName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
      : "PT");

  const photoUrl =
    profile?.photoUrl ||
    profile?.photo ||
    identity.photoUrl ||
    identity.photo;

  const menuItems = [
    { label: "DASHBOARD", path: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
    { label: "BASIC INFO", path: "/basicInfo", icon: UserRound, key: "basicInfo" },
    { label: "ABHA ID", path: "/abha", icon: Shield, key: "abha" },
    { label: "DOCUMENTS", path: "/uploadDoc", icon: FileText, key: "uploadDoc" },
    { label: "CONSENT", path: "/consent", icon: FileCheck, key: "consent" },
    { label: "SOCRATES FORM", path: "/socrates", icon: ClipboardList, key: "socrates" },
    { label: "MEDICAL DIRECTORY", path: "/kindle", icon: BookOpen, key: "kindle" },
    { label: "NEARBY HOSPITALS", path: "/nearby-hospitals", icon: Building2, key: "nearbyHospitals" },
    { label: "PROFILE", path: "/profile", icon: User, key: "profile" },
    { label: "GENAI BOT", path: "/genai", icon: Bot, key: "genai" },
  ];

  const isItemActive = (item) => {
    if (activePage) {
      if (item.key === "kindle" && (activePage === "kindle" || activePage === "health-code")) return true;
      return activePage === item.key;
    }
    if (currentPath === item.path) return true;
    if (item.key === "abha" && currentPath === "/abhaId") return true;
    if (item.key === "uploadDoc" && currentPath === "/docs") return true;
    if (item.key === "kindle" && (currentPath === "/kindle" || currentPath === "/kindlemain" || currentPath === "/health-code" || currentPath === "/namaste-code" || currentPath === "/icd-code")) return true;
    if (item.key === "nearbyHospitals" && (currentPath === "/nearby-hospitals" || currentPath === "/emergency")) return true;
    return false;
  };

  return (
    <aside className="patient-sidebar">
      {/* Merged Single Column Sidebar Card */}
      <div className="patient-sidebar-block" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {/* 1. Profile Header */}
        <div>
          <div className="patient-sidebar-label" style={{ marginBottom: '0.6rem' }}>Profile</div>
          <div className="patient-profile-card">
            <div className="patient-avatar-circle">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Patient DP"
                  className="patient-avatar-img"
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>

            <div className="patient-sidebar-info">
              <h4 className="patient-sidebar-name">{pName}</h4>

              <p className="patient-sidebar-spec">
                {identity.gender || profile?.gender || "Patient"}
                {identity.bloodGroup || profile?.bloodGroup ? ` • ${identity.bloodGroup || profile?.bloodGroup}` : ""}
              </p>

              <span className="patient-status-online">
                ● Active Patient
              </span>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0' }} />

        {/* 2. Menu Section */}
        <div>
          <div className="patient-sidebar-label" style={{ marginBottom: '0.6rem' }}>Menu</div>
          <div className="patient-sidebar-nav">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <button
                  key={item.key}
                  className={`patient-sidebar-item ${active ? "active" : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="patient-sidebar-icon" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        
        
      </div>
    </aside>
  );
};

export default PatientSidebar;
