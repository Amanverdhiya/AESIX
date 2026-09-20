import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../../shared/BrandLogo';
import DoctorActivityBell from '../components/DoctorActivityBell';
import { useDashboardLanguage } from '../LanguageContext';
import {
  Phone,
  PhoneCall,
  Navigation,
  MapPin,
  Clock,
  Star,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Compass,
  Search,
  ExternalLink,
  ShieldAlert,
  CircleUser,
  LogOut,
} from 'lucide-react';
import PatientSidebar from '../components/asidebar';
import './NearbyHospitals.css';
import '../userPages.css';
import 'leaflet/dist/leaflet.css';
import { fetchApi } from '../../../shared/apiBase';

// Default center: Connaught Place, New Delhi (if GPS unavailable)
const DEFAULT_COORDS = { lat: 28.6139, lng: 77.2090 };

export default function NearbyHospitals() {
  const navigate = useNavigate();
  const { language, setLanguage } = useDashboardLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [locationName, setLocationName] = useState('Detecting location...');
  const [gpsActive, setGpsActive] = useState(false);
  const [radius, setRadius] = useState(5000); // 5km
  const [filterType, setFilterType] = useState('all'); // all | 24hours | hospital | clinic
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // 1. Request User's Live Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          setCoords({ lat: userLat, lng: userLng });
          setLocationName('Your Current GPS Location');
          setGpsActive(true);
        },
        (err) => {
          console.warn('Geolocation denied/unavailable, using default coordinates:', err.message);
          setLocationName('New Delhi (Default Location)');
          setGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocationName('Location unavailable');
    }
  }, []);

  // 2. Fetch Nearby Hospitals from Backend
  useEffect(() => {
    let isMounted = true;

    async function fetchHospitals() {
      setLoading(true);
      setError('');
      try {
        const res = await fetchApi(`/users/nearby-hospitals?lat=${coords.lat}&lng=${coords.lng}&radius=${radius}&limit=10`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load hospitals');
        }

        if (isMounted) {
          setHospitals(json.data || []);
          if (json.data?.length > 0) {
            setSelectedHospital(json.data[0]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Could not fetch nearby facilities');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchHospitals();

    return () => {
      isMounted = false;
    };
  }, [coords, radius]);

  // 3. Initialize & Update Interactive Leaflet Map
  useEffect(() => {
    let L;
    let isCancelled = false;

    async function initMap() {
      try {
        const leafletMod = await import('leaflet');
        L = leafletMod.default || leafletMod;
      } catch {
        // Fallback to window.L if imported globally
        L = window.L;
      }

      if (!L || !mapContainerRef.current || isCancelled) return;

      // Clean up previous instance if coords changed significantly
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [coords.lat, coords.lng],
          zoom: 13,
          zoomControl: false,
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Clean OpenStreetMap Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([coords.lat, coords.lng], 13);
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Add User Location Pulse Marker
      const userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: `<div class="user-marker-pulse" title="Your Location"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const userMarker = L.marker([coords.lat, coords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<strong>Your Location</strong><br/>${locationName}`);
      markersRef.current.push(userMarker);

      // Add Hospital Pins
      hospitals.forEach((h, index) => {
        if (!h.lat || !h.lng) return;

        const isSelected = selectedHospital?.id === h.id;
        const hospitalIcon = L.divIcon({
          className: 'custom-hospital-icon',
          html: `<div class="hospital-map-pin ${isSelected ? 'selected' : ''}"><span>+</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([h.lat, h.lng], { icon: hospitalIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: Inter, sans-serif; font-size: 0.85rem; padding: 2px;">
              <strong style="font-size: 0.95rem; color: #0f172a;">${h.name}</strong>
              <div style="color: #64748b; font-size: 0.78rem; margin: 3px 0;">${h.category} • ${h.durationText} (${h.distanceText})</div>
              <div style="color: #334155; font-size: 0.8rem; margin-bottom: 8px;">${h.address}</div>
              <div style="display: flex; gap: 6px;">
                <a href="tel:${h.phone}" style="background: #16a34a; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 0.75rem;">📞 Call ${h.phone}</a>
                <a href="${h.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 0.75rem;">Directions</a>
              </div>
            </div>
          `);

        marker.on('click', () => {
          setSelectedHospital(h);
        });

        markersRef.current.push(marker);
      });
    }

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [coords, hospitals, selectedHospital]);

  // Handle clicking hospital from list -> pan map & focus
  const handleSelectHospital = (h) => {
    setSelectedHospital(h);
    if (mapInstanceRef.current && h.lat && h.lng) {
      mapInstanceRef.current.flyTo([h.lat, h.lng], 15, { duration: 1 });
      const targetMarker = markersRef.current.find(
        (m) => m.getLatLng().lat === h.lat && m.getLatLng().lng === h.lng
      );
      if (targetMarker) {
        targetMarker.openPopup();
      }
    }
  };

  // Filter hospitals by type
  const filteredHospitals = hospitals.filter((h) => {
    if (filterType === '24hours') return h.isOpenNow;
    if (filterType === 'clinic') return h.category?.toLowerCase().includes('clinic');
    if (filterType === 'hospital') return h.category?.toLowerCase().includes('hospital') || h.category?.toLowerCase().includes('trauma');
    return true;
  });

  const handleRefreshLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationName('Your Current GPS Location');
          setGpsActive(true);
        },
        () => {
          setLoading(false);
          alert('Could not access GPS. Please check location permissions.');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="sih-page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      {/* Global Topbar */}
      <header className="sih-header" style={{ flexShrink: 0 }}>
            <div className="sih-header-inner">
              <BrandLogo subtitle="Nearby Hospitals" />

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
                        <span className="dd-icon"><CircleUser /></span> Profile
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

          <div className="patient-main-container" style={{ height: 'calc(100vh - 80px)', padding: 0, display: 'flex' }}>
            <PatientSidebar activePage="nearbyHospitals" />
            <div className="patient-content-area" style={{ padding: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="nearby-hospitals-page" style={{ height: '100%', minHeight: 'auto', overflow: 'hidden', flex: 1 }}>
            <main className="nearby-hospitals-main" style={{ height: '100%' }}>
        {/* Header Bar */}
        <header className="nh-header">
          <div className="nh-header-top">
            <div className="nh-title-wrap">
              <div className="nh-icon-badge">
                <Building2 size={22} />
              </div>
              <div>
                <h1>Emergency & Nearby Medical Care</h1>
                <p>Top nearest hospitals, clinics, direct emergency lines & live driving times</p>
              </div>
            </div>

            {/* Emergency Hotline Badges (One-tap direct calling) */}
            <div className="nh-helplines">
              <a href="tel:108" className="nh-helpline-pill ambulance" title="Call Emergency Ambulance">
                <PhoneCall size={14} /> 108 Ambulance
              </a>
              <a href="tel:112" className="nh-helpline-pill" title="National Emergency Helpline">
                <ShieldAlert size={14} /> 112 National Emergency
              </a>
              <a href="tel:102" className="nh-helpline-pill" title="Maternity & Infant Emergency">
                <Phone size={14} /> 102 Maternity
              </a>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="nh-controls-bar">
            <div className="nh-location-status">
              <MapPin size={16} color="#DC2626" />
              <span>{locationName}</span>
              <button
                type="button"
                className="nh-gps-btn"
                onClick={handleRefreshLocation}
                title="Refresh live location"
              >
                <Compass size={13} /> {gpsActive ? 'GPS Active' : 'Use Live GPS'}
              </button>
            </div>

            <div className="nh-filters">
              <button
                type="button"
                className={`nh-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All ({hospitals.length})
              </button>
              <button
                type="button"
                className={`nh-filter-btn ${filterType === '24hours' ? 'active' : ''}`}
                onClick={() => setFilterType('24hours')}
              >
                Open Now
              </button>
              <button
                type="button"
                className={`nh-filter-btn ${filterType === 'hospital' ? 'active' : ''}`}
                onClick={() => setFilterType('hospital')}
              >
                Hospitals
              </button>
              <button
                type="button"
                className={`nh-filter-btn ${filterType === 'clinic' ? 'active' : ''}`}
                onClick={() => setFilterType('clinic')}
              >
                Clinics
              </button>

              <select
                className="nh-radius-select"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                title="Search radius"
              >
                <option value={3000}>Within 3 km</option>
                <option value={5000}>Within 5 km</option>
                <option value={10000}>Within 10 km</option>
                <option value={15000}>Within 15 km</option>
              </select>
            </div>
          </div>
        </header>

        {/* Content Body: Split View (List + Interactive Map) */}
        <div className="nh-content-body">
          {/* Left Column: List of Facilities */}
          <aside className="nh-list-panel">
            <div className="nh-list-header">
              <CheckCircle2 size={15} />
              <span>Showing {filteredHospitals.length} closest emergency facilities</span>
            </div>

            {loading ? (
              <div className="nh-loading-state">
                <div className="nh-spinner" />
                <p>Finding nearest hospitals & calculating route times…</p>
              </div>
            ) : error ? (
              <div className="nh-empty-state">
                <AlertTriangle size={32} color="#DC2626" />
                <p>{error}</p>
                <button type="button" className="nh-gps-btn" onClick={handleRefreshLocation}>
                  Retry Search
                </button>
              </div>
            ) : filteredHospitals.length === 0 ? (
              <div className="nh-empty-state">
                <Building2 size={32} color="#94A3B8" />
                <p>No facilities found matching filter in this radius.</p>
                <button type="button" className="nh-gps-btn" onClick={() => setRadius(radius + 5000)}>
                  Expand to {radius / 1000 + 5} km
                </button>
              </div>
            ) : (
              <div className="nh-hospitals-list">
                {filteredHospitals.map((h, idx) => {
                  const isSelected = selectedHospital?.id === h.id;
                  return (
                    <div
                      key={h.id || idx}
                      className={`nh-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectHospital(h)}
                    >
                      <div className="nh-card-header">
                        <h3 className="nh-card-title">
                          {idx + 1}. {h.name}
                        </h3>
                        <span className="nh-card-category">{h.category}</span>
                      </div>

                      {/* Travel Duration & Total Distance Badges */}
                      <div className="nh-metrics-row">
                        <span className="nh-badge-time">
                          <Clock size={12} /> {h.durationText} drive
                        </span>
                        <span className="nh-badge-dist">
                          <Navigation size={12} /> {h.distanceText} away
                        </span>
                        {h.isOpenNow && (
                          <span className="nh-badge-open">
                            ● 24/7 Open
                          </span>
                        )}
                        {h.rating && (
                          <span className="nh-badge-dist">
                            <Star size={12} color="#EAB308" fill="#EAB308" /> {h.rating}
                          </span>
                        )}
                      </div>

                      {/* Full Address */}
                      <p className="nh-card-address">
                        <MapPin size={14} style={{ flexShrink: 0, marginTop: 2, color: '#64748B' }} />
                        <span>{h.address}</span>
                      </p>

                      {/* Action Buttons: Direct Calling & Google Maps Directions */}
                      <div className="nh-card-actions" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${h.phone}`}
                          className="nh-btn-call"
                          title="Call hospital directly"
                        >
                          <PhoneCall size={14} />
                          <span>Call {h.phone.length > 13 ? h.phone.slice(0, 13) + '…' : h.phone}</span>
                        </a>

                        <a
                          href={h.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nh-btn-dir"
                          title="Open Google Maps driving directions"
                        >
                          <Navigation size={14} />
                          <span>Directions</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Column: Live Map */}
          <section className="nh-map-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div ref={mapContainerRef} className="nh-map-container" style={{ flex: 1, minHeight: '500px', width: '100%' }} />

            {selectedHospital && (
              <div className="nh-map-overlay">
                <div>
                  <strong style={{ color: '#0F172A', display: 'block' }}>{selectedHospital.name}</strong>
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>{selectedHospital.durationText} drive</span>
                  <span style={{ color: '#64748B' }}> • {selectedHospital.distanceText}</span>
                </div>
                <a
                  href={`tel:${selectedHospital.phone}`}
                  className="nh-btn-call"
                  style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                >
                  <PhoneCall size={13} /> Call
                </a>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  </div>
</div>
</div>
  );
}
