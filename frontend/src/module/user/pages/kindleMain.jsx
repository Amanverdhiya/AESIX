import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../userPages.css';
import { userApi } from '../services/userApi';
import { useDashboardLanguage } from '../LanguageContext';
import PatientSidebar from '../components/asidebar';
import ChatbotFAB from '../components/ChatbotFAB';
import DoctorActivityBell from '../components/DoctorActivityBell';
import BrandLogo from '../../../shared/BrandLogo';
import {
  FileText,
   CircleUser,
    LogOut,
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
  ChevronDown,
  ChevronUp
} from "lucide-react";

const FEATURED_NAMASTE_TERMS = ['Jvara', 'Madhumeha', 'Kasa', 'Atisara', 'Amlapitta', 'Shvasa'];

/* ── Encyclopedia helpers: clean text, tags, sections ── */
function stripHtml(value) {
  if (value == null) return '';
  const raw = typeof value === 'string' ? value : (value['@value'] ?? value.value ?? '');
  return String(raw).replace(/<[^>]*>/g, '').replace(/[@#]/g, '').replace(/\s+/g, ' ').trim();
}

function EncyTag({ children, color = 'var(--teal-primary)', bg = 'var(--mint-light)' }) {
  return (
    <span style={{ display: 'inline-block', background: bg, color, borderRadius: '6px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700, margin: '0.15rem 0.15rem 0 0', border: `1px solid ${color}22` }}>
      {children}
    </span>
  );
}

function EncySection({ icon, title, children, accent = '#F8FAFC' }) {
  return (
    <div style={{ backgroundColor: accent, padding: '1rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
      <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span>{icon}</span>{title}
      </h4>
      {children}
    </div>
  );
}

function FactCell({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.55rem 0.7rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--teal-primary)' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-navy)', marginTop: '0.15rem', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

function WhoVerifyCard({ record }) {
  const enc = record.icd11Encyclopedia || {};
  const links = record.whoLinks || {};
  const browserUrl = enc.browserUrl || links.browserUrl || record.icd11Details?.browserUrl || 'https://icd.who.int/browse/2024-01/mms/en';
  const searchUrl = enc.searchUrl || links.searchUrl || browserUrl;
  const entityUrl = enc.entityUrl || links.entityUrl || record.icd11EntityUri;
  const code = enc.code || record.icd11PrimaryCode || record.code;
  return (
    <EncySection icon="🛡️" title="Verify on official WHO ICD-11 browser" accent="#EFF6FF">
      <p style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.55, margin: '0 0 0.6rem' }}>
        Cross-check this {code} classification against the World Health Organization registry. Our definition, synonyms and hierarchy below mirror the WHO source.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <a href={browserUrl} target="_blank" rel="noopener noreferrer" className="sih-btn sih-btn-primary" style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem', textDecoration: 'none' }}>
          Open {code} on icd.who.int ↗
        </a>
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="sih-btn sih-btn-outline" style={{ fontSize: '0.75rem', padding: '0.45rem 0.9rem', textDecoration: 'none' }}>
          Search WHO browser ↗
        </a>
      </div>
      {entityUrl && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem', wordBreak: 'break-all' }}>
          API entity: {entityUrl}
        </div>
      )}
      {record.icd11MappingVersion && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Mapping version: {record.icd11MappingVersion}
        </div>
      )}
    </EncySection>
  );
}

function MappingPanel({ record, onOpenNamaste, onOpenIcd }) {
  const forward = record.icdMappings || (record.icd11PrimaryCode ? [{ code: record.icd11PrimaryCode, title: record.englishEquivalent, entityUri: record.icd11EntityUri, equivalenceType: record.icd11EquivalenceType, ...(record.whoLinks || {}) }] : []);
  const reverse = record.namasteMappings || [];
  const isIcdOrigin = String(record.systemOfMedicine || '').includes('WHO ICD-11');
  return (
    <EncySection icon="🔗" title="ICD-11 ↔ NAMASTE cross-walk (both directions)" accent="#F0FDF4">
      {/* Forward: NAMASTE → ICD */}
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-navy)', marginBottom: '0.4rem' }}>
        {isIcdOrigin ? 'This ICD-11 entity corresponds to:' : 'NAMASTE → ICD-11 mapping'}
      </div>
      {forward.length > 0 ? forward.map((m, i) => (
        <div key={i} style={{ backgroundColor: '#fff', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.45rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <strong style={{ fontFamily: 'monospace', color: 'var(--primary-navy)', fontSize: '0.85rem' }}>{m.code}</strong>
            {m.equivalenceType && <EncyTag color="#166534" bg="#DCFCE7">{m.equivalenceType}</EncyTag>}
          </div>
          {m.title && <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>{stripHtml(m.title)}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
            {(m.browserUrl || record.whoLinks?.browserUrl) && (
              <a href={m.browserUrl || record.whoLinks.browserUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-primary)' }}>
                Verify on WHO ↗
              </a>
            )}
            {!isIcdOrigin && onOpenIcd && (
              <button onClick={() => onOpenIcd(m.code, m.entityUri, m.title)} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                View ICD record →
              </button>
            )}
          </div>
        </div>
      )) : (
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
          No confirmed ICD-11 cross-reference yet. Check the{' '}
          <a href="https://icd.who.int/browse/2024-01/mms/en" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-primary)', fontWeight: 700 }}>WHO browser</a>{' '}
          manually (TM2 chapter often holds the equivalent).
        </p>
      )}

      {/* Reverse: ICD → NAMASTE */}
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-navy)', margin: '0.7rem 0 0.4rem' }}>
        {isIcdOrigin ? 'ICD-11 → NAMASTE matches (Ayurveda equivalents)' : 'Same ICD shared by (reverse peers)'} ({reverse.length})
      </div>
      {reverse.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {reverse.map((m, i) => (
            <button key={i} onClick={() => onOpenNamaste && onOpenNamaste(m.code)} style={{ textAlign: 'left', backgroundColor: '#fff', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.55rem 0.7rem', cursor: onOpenNamaste ? 'pointer' : 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--primary-navy)' }}>{m.code}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.matchReason}</span>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--teal-primary)', marginTop: '0.15rem' }}>{m.ayurvedicTerm}</div>
              {m.englishEquivalent && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.englishEquivalent}</div>}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
          No Ayurveda equivalent catalogued for this ICD entity yet.
        </p>
      )}
    </EncySection>
  );
}

function EncyclopediaDetail({ record, onOpenNamaste, onOpenIcd }) {
  if (!record) return null;
  const whoDef = stripHtml(record.icd11Encyclopedia?.definition || record.icd11Details?.definition?.['@value'] || record.icd11Details?.definition);
  const ayurDef = stripHtml(record.clinicalOverview?.definition);
  const synonyms = record.icd11Encyclopedia?.synonyms || [];
  const inclusion = record.icd11Encyclopedia?.inclusion || [];
  const exclusion = record.icd11Encyclopedia?.exclusion || [];
  const completeness = record.completeness?.percentage;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
          <span className="sih-badge sih-badge-teal" style={{ fontFamily: 'monospace' }}>{record.code}</span>
          <span className="sih-badge sih-badge-green">{record.systemOfMedicine}</span>
          {record.icd11PrimaryCode && <span className="sih-badge sih-badge-green">ICD-11: {record.icd11PrimaryCode}</span>}
          {record.icd11EquivalenceType && <span className="sih-badge sih-badge-amber">{record.icd11EquivalenceType}</span>}
          {typeof completeness === 'number' && <span className="sih-badge sih-badge-teal">{completeness}% complete</span>}
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-navy)', margin: '0.2rem 0' }}>
          {stripHtml(record.englishEquivalent) !== 'No English equivalent supplied by source' ? stripHtml(record.englishEquivalent) : stripHtml(record.ayurvedicTerm)}
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--teal-primary)', fontWeight: 700, margin: '0.15rem 0' }}>{stripHtml(record.ayurvedicTerm)}</p>
        {record.transliteration && record.transliteration !== record.ayurvedicTerm && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{stripHtml(record.transliteration)}</p>
        )}
        {record.breadcrumb?.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {record.breadcrumb.map(b => b.code).join(' › ')}{record.breadcrumb.length > 0 ? ' › ' : ''}{record.code}
          </div>
        )}
      </div>

      {/* Quick facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
        <FactCell label="Classification code" value={record.code} mono />
        <FactCell label="ICD-11 code" value={record.icd11PrimaryCode || '—'} mono />
        <FactCell label="Ayurvedic term" value={stripHtml(record.ayurvedicTerm)} />
        <FactCell label="System" value={record.systemOfMedicine} />
        <FactCell label="Equivalence" value={record.icd11EquivalenceType || record.icd11MappingStatus} />
        <FactCell label="Last updated" value={record.lastUpdated || record.catalogVersion} />
      </div>

      {/* Definitions: clean encyclopedia */}
      <EncySection icon="📖" title="Encyclopedia definition">
        {ayurDef && !ayurDef.startsWith('No definition') && !ayurDef.startsWith('Dynamically fetched') && (
          <p style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'var(--text-main)', margin: '0 0 0.6rem' }}>{ayurDef}</p>
        )}
        {whoDef ? (
          <div style={{ backgroundColor: '#EFF6FF', borderLeft: '3px solid #2563EB', padding: '0.6rem 0.8rem', borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>WHO ICD-11 official definition</div>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: '#1E3A5F', margin: 0 }}>{whoDef}</p>
          </div>
        ) : (
          (!ayurDef || ayurDef.startsWith('No definition') || ayurDef.startsWith('Dynamically fetched')) && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Definition pending WHO verification — use the WHO link below to view the live registry entry.</p>
          )
        )}
        {synonyms.length > 0 && (
          <div style={{ marginTop: '0.6rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-navy)', marginBottom: '0.25rem' }}>Also known as</div>
            <div>{synonyms.slice(0, 8).map((s, i) => <EncyTag key={i}>{s}</EncyTag>)}</div>
          </div>
        )}
        {(inclusion.length > 0 || exclusion.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.6rem' }}>
            {inclusion.length > 0 && (
              <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534' }}>Includes</div>
                {inclusion.slice(0, 5).map((v, i) => <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-main)' }}>• {v}</div>)}
              </div>
            )}
            {exclusion.length > 0 && (
              <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#991B1B' }}>Excludes</div>
                {exclusion.slice(0, 5).map((v, i) => <div key={i} style={{ fontSize: '0.73rem', color: 'var(--text-main)' }}>• {v}</div>)}
              </div>
            )}
          </div>
        )}
      </EncySection>

      {/* Symptoms encyclopedia table */}
      {(record.parsedSymptoms?.length > 0 || record.clinicalOverview?.cardinalSymptoms?.length > 0) && (
        <EncySection icon="🩺" title={`Symptoms encyclopedia (${record.parsedSymptoms?.length || record.clinicalOverview?.cardinalSymptoms?.length || 0})`}>
          {record.parsedSymptoms?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--teal-primary)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border-light)', width: '2rem' }}>#</th>
                  <th style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border-light)' }}>Sanskrit term</th>
                  <th style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border-light)' }}>Clinical meaning</th>
                </tr>
              </thead>
              <tbody>
                {record.parsedSymptoms.slice(0, 12).map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '0.35rem 0.5rem', fontStyle: 'italic', color: 'var(--primary-navy)', fontWeight: 600 }}>{s.term}</td>
                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-main)' }}>{s.gloss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>{record.clinicalOverview.cardinalSymptoms.slice(0, 8).map((s, i) => <EncyTag key={i}>{stripHtml(s)}</EncyTag>)}</div>
          )}
          {record.biomedicalSummary && (
            <div style={{ marginTop: '0.6rem', backgroundColor: '#F0FDF4', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.76rem', color: '#14532D' }}>
              <strong>Biomedical correlation: </strong>{record.biomedicalSummary}
            </div>
          )}
        </EncySection>
      )}

      {/* Triage */}
      {record.prognosis && (
        <div style={{ backgroundColor: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '0.9rem 1rem', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>Triage: {record.prognosis.status}</span>
            <span className="sih-badge sih-badge-amber" style={{ fontSize: '0.68rem' }}>Risk: {record.prognosis.riskLevel}</span>
          </div>
          {record.clinicalOverview?.redFlags?.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.25rem' }}>🚩 Red flags</div>
              <div>{record.clinicalOverview.redFlags.map((f, i) => <EncyTag key={i} color="#991B1B" bg="#FEF2F2">{f}</EncyTag>)}</div>
            </div>
          )}
        </div>
      )}

      {/* Samprapti + Chikitsa */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem' }}>
        {record.pathomechanism && (
          <EncySection icon="🌿" title="Samprapti (pathomechanism)">
            <div style={{ marginBottom: '0.45rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-navy)' }}>Dominant dosha</div>
              <div>{record.pathomechanism.dominantDosha?.map((d, i) => <EncyTag key={i} color="#7C3AED" bg="#F5F3FF">{d}</EncyTag>)}</div>
            </div>
            <div style={{ marginBottom: '0.45rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-navy)' }}>Srotas involved</div>
              <div>{record.pathomechanism.srotasInvolved?.map((s, i) => <EncyTag key={i} color="#0369A1" bg="#F0F9FF">{s}</EncyTag>)}</div>
            </div>
            {record.pathomechanism.phenotypeCheck && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5, margin: '0.4rem 0 0' }}>{record.pathomechanism.phenotypeCheck}</p>}
          </EncySection>
        )}
        {record.treatmentFramework && (
          <EncySection icon="💊" title="Chikitsa (treatment)" accent="#FEFCE8">
            {record.treatmentFramework.chikitsaSutra && (
              <p style={{ fontSize: '0.76rem', lineHeight: 1.55, color: '#713F12', fontStyle: 'italic', backgroundColor: 'rgba(254,240,138,0.35)', padding: '0.55rem 0.75rem', borderRadius: '8px', borderLeft: '3px solid #EAB308', margin: '0 0 0.6rem' }}>
                “{record.treatmentFramework.chikitsaSutra}”
              </p>
            )}
            {record.treatmentFramework.classicalFormulations?.length > 0 && (
              <div style={{ marginBottom: '0.45rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-navy)' }}>Classical formulations</div>
                <div>{record.treatmentFramework.classicalFormulations.map((f, i) => <EncyTag key={i} color="#92400E" bg="#FFFBEB">{f}</EncyTag>)}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.4rem' }}>
              {record.treatmentFramework.pathya?.length > 0 && (
                <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534' }}>✅ Pathya</div>
                  {record.treatmentFramework.pathya.slice(0, 5).map((p, i) => <div key={i} style={{ fontSize: '0.72rem' }}>• {p}</div>)}
                </div>
              )}
              {record.treatmentFramework.apathya?.length > 0 && (
                <div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#991B1B' }}>❌ Apathya</div>
                  {record.treatmentFramework.apathya.slice(0, 5).map((a, i) => <div key={i} style={{ fontSize: '0.72rem' }}>• {a}</div>)}
                </div>
              )}
            </div>
          </EncySection>
        )}
      </div>

      {record.labCorrelations?.suggestedTests?.length > 0 && (
        <EncySection icon="🔬" title="Investigations">
          <div>{record.labCorrelations.suggestedTests.map((t, i) => <EncyTag key={i} color="#0F766E" bg="#F0FDFA">{t}</EncyTag>)}</div>
        </EncySection>
      )}

      {/* Bidirectional mapping + WHO verification */}
      <MappingPanel record={record} onOpenNamaste={onOpenNamaste} onOpenIcd={onOpenIcd} />
      <WhoVerifyCard record={record} />

      {/* Hierarchy + provenance */}
      {(record.parentDisease || record.relatedCodes?.length > 0) && (
        <EncySection icon="🧬" title="Classification hierarchy">
          {record.parentDisease && <div style={{ fontSize: '0.76rem', marginBottom: '0.35rem' }}><strong>Parent: </strong>{record.parentDisease.code} — {stripHtml(record.parentDisease.englishEquivalent)}</div>}
          {record.relatedCodes?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              {record.relatedCodes.map((r, i) => (
                <button key={i} onClick={() => onOpenNamaste && onOpenNamaste(r.code)} style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px', border: '1px solid var(--border-light)', background: '#fff', cursor: 'pointer' }}>
                  {r.code}
                </button>
              ))}
            </div>
          )}
        </EncySection>
      )}
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {record.source && <div><strong>Source:</strong> {record.source}</div>}
        {record.catalogVersion && <div><strong>Catalog:</strong> {record.catalogVersion}</div>}
        {record.icd11MappingVersion && <div><strong>Mapping:</strong> {record.icd11MappingVersion}</div>}
        {record.lastUpdated && <div><strong>Updated:</strong> {record.lastUpdated}</div>}
      </div>
    </div>
  );
}

export default function KindleMain({ embedded = false }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('namaste'); // 'namaste' or 'icd11'

  // Search queries & suggestions
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [featuredRecords, setFeaturedRecords] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Selected disease record
  const [selectedCode, setSelectedCode] = useState(null);
  const [record, setRecord] = useState(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);

  // Right detail panel is capped at ~left search-box height; the toggle
  // ("dropdown button") expands it to full depth on click.
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [detailClipped, setDetailClipped] = useState(false);
  const detailBodyRef = useRef(null);
  const detailCardRef = useRef(null);

  // Header state (shared global language — only clicked language is shown)
  const { language, setLanguage } = useDashboardLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Dynamic profile
  const [patientName, setPatientName] = useState('Profile');
  const [initials, setInitials] = useState('PT');

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user_profile') || '{}');
      const fullName = storedUser.fullName || (storedUser.firstName ? `${storedUser.firstName} ${storedUser.lastName || ''}`.trim() : '');
      const firstName = fullName ? fullName.split(' ')[0] : 'Profile';
      
      setPatientName(firstName);
      
      const initialsStr = fullName && fullName !== 'Patient' 
        ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) 
        : "PT";
      setInitials(initialsStr);
    } catch (err) {
      setPatientName('Profile');
      setInitials('PT');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live suggestions / search debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setSearchError('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        if (activeTab === 'namaste') {
          const res = await userApi.searchNamaste(trimmed);
          setSuggestions(res.results || []);
        } else {
          const res = await userApi.searchICD11(trimmed);
          const items = res.destinationEntities || res.entities || res.items || [];
          setSuggestions(items);
        }
      } catch (err) {
        setSearchError(err.message || 'Search failed');
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  // Give the directory useful content immediately without pre-populating the
  // search-results list. Two records are stacked in the detail pane.
  useEffect(() => {
    let cancelled = false;
    const terms = [...FEATURED_NAMASTE_TERMS].sort(() => Math.random() - 0.5).slice(0, 5);
    setFeaturedLoading(true);
    Promise.all(terms.map(async (term) => {
      const search = await userApi.searchNamaste(term);
      return search?.results?.[0] || null;
    }))
      .then(async (entries) => {
        const validEntries = entries.filter(Boolean);
        if (!cancelled) setSuggestions(validEntries);
        const records = await Promise.all(validEntries.slice(0, 2).map((entry) => userApi.getDiseaseRecord(entry.code)));
        if (!cancelled) setFeaturedRecords(records.filter(Boolean));
      })
      .catch(() => { if (!cancelled) { setFeaturedRecords([]); setSuggestions([]); } })
      .finally(() => { if (!cancelled) setFeaturedLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setQuery('');
    setSuggestions([]);
    setSearchError('');
  };

  const handleSelectCode = async (code, entityUri, titleHint) => {
    setSelectedCode(code);
    setIsLoadingRecord(true);
    setRecord(null);
    // New disease → start capped again so the panel never opens deep.
    setDetailExpanded(false);
    try {
      const data = await userApi.getDiseaseRecord(code, entityUri);
      // Backfill ICD → NAMASTE reverse peers when backend has none yet
      // (e.g. freshly cached WHO entity), so mapping reads both ways.
      if ((!data.namasteMappings || data.namasteMappings.length === 0) && (data.icd11PrimaryCode || activeTab === 'icd11')) {
        try {
          const mapping = await userApi.getIcdToNamaste(data.icd11PrimaryCode || code, data.englishEquivalent || titleHint || '');
          if (mapping?.namasteMappings?.length) data.namasteMappings = mapping.namasteMappings;
        } catch { /* mapping is best-effort */ }
      }
      setRecord(data);
    } catch (err) {
      setSearchError(err.message || 'Failed to fetch clinical record');
    } finally {
      setIsLoadingRecord(false);
    }
  };

  const openNamasteRecord = async (code) => {
    setActiveTab('namaste');
    setQuery(code);
    await handleSelectCode(code);
  };

  const openIcdRecord = async (code, entityUri, title) => {
    setActiveTab('icd11');
    setQuery(code);
    await handleSelectCode(code, entityUri, title);
  };

  const parseItemLabel = (item) => {
    const val = item.title || item.theCodeAndTitle?.title || item.matchingPhrases?.[0]?.label || item.id || 'WHO ICD-11 Entity';
    return String(val).replace(/<[^>]*>/g, '');
  };

  const parseItemCode = (item) => {
    return item.theCode || item.theCodeAndTitle?.code || item.code || item.id || item.entityId || parseItemLabel(item);
  };

  // Show the expand toggle only when the detail body actually overflows
  // the capped height (short entries need no dropdown button).
  const hasDetailContent = Boolean(record) || featuredRecords.length > 0;
  useEffect(() => {
    if (detailExpanded) {
      setDetailClipped(true);
      return;
    }
    const el = detailBodyRef.current;
    if (!el || !hasDetailContent) {
      setDetailClipped(false);
      return;
    }
    const check = () => {
      setDetailClipped(el.scrollHeight > el.clientHeight + 8);
    };
    check();
    window.addEventListener('resize', check);
    // Re-check after fonts/images settle.
    const timer = setTimeout(check, 500);
    return () => {
      window.removeEventListener('resize', check);
      clearTimeout(timer);
    };
  }, [record, featuredRecords, featuredLoading, isLoadingRecord, detailExpanded, hasDetailContent]);

  const toggleDetail = () => {
    if (detailExpanded) {
      setDetailExpanded(false);
      // Back to capped view → bring the panel top back into view.
      detailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setDetailExpanded(true);
    }
  };

  return (
    <div className={embedded ? 'doc-embedded-directory' : 'sih-page-wrapper'} style={{ minHeight: embedded ? 0 : '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mint-bg)' }}>
      {/* ===== HEADER ===== */}
      {!embedded && <header className="sih-header">
        <div className="sih-header-inner">
          {/* Brand */}
          <BrandLogo subtitle="Clinical Directory" />



          {/* Header Controls */}
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
                <div className="sih-profile-avatar">{initials}</div>
                <span className="sih-profile-name">{patientName}</span>
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
      </header>}

      <div className={embedded ? 'doc-embedded-directory-content' : 'patient-main-container'}>
        {!embedded && <PatientSidebar patientName={patientName} initials={initials} activePage="kindle" />}
        <div className={embedded ? '' : 'patient-content-area'}>

          {/* ===== MAIN CONTENT ===== */}
          <main className="sih-main-layout" style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            {/* Top Banner */}
            <div className="sih-card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="sih-badge sih-badge-teal">CDSS & Terminology Service</span>
                  <span className="sih-badge sih-badge-green">WHO ICD-11 Live</span>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary-navy)', margin: '0.4rem 0 0.2rem' }}>
                  NAMASTE ↔ WHO ICD-11 Directory
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Search across 4,500+ official AYUSH NAMASTE clinical terms and live WHO ICD-11 international disease classifications.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleTabSwitch('namaste')}
                  className={`sih-btn ${activeTab === 'namaste' ? 'sih-btn-primary' : 'sih-btn-outline'}`}
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                >
                  
<Leaf size={20} /> NAMASTE (Ayurveda)
                </button>
                <button
                  onClick={() => handleTabSwitch('icd11')}
                  className={`sih-btn ${activeTab === 'icd11' ? 'sih-btn-primary' : 'sih-btn-outline'}`}
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Globe size={20} /> WHO ICD-11 (Global)
                </button>
              </div>
            </div>

            {/* Two-Column Explorer Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(0, 1.8fr)', gap: '1.5rem', alignItems: 'start' }}>

              {/* Left Column: Search & Results List */}
              <div className="sih-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="sih-input"
                    placeholder={activeTab === 'namaste' ? 'Search Jvara, Madhumeha, A-101...' : 'Search Diabetes, 5A11, Fever, 1B10...'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '0.9rem' }}
                  />
                  <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Search size={20} />
                  </span>
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Sample Prompts */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Samples:</span>
                  {(activeTab === 'namaste' ? ['Jvara', 'Madhumeha', 'Kasa', 'Atisara'] : ['Diabetes', '5A11', 'Fever', '1B10']).map((sample) => (
                    <button
                      key={sample}
                      onClick={() => setQuery(sample)}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--teal-primary)',
                        backgroundColor: 'var(--mint-light)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        border: '1px solid rgba(47, 143, 131, 0.2)',
                        cursor: 'pointer'
                      }}
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                {/* Results Count / Loading */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>{isSearching ? 'Searching database & WHO API…' : `${suggestions.length} entries found`}</span>
                  {isSearching && <span style={{ color: 'var(--teal-primary)' }}>Loading…</span>}
                </div>

                {searchError && (
                  <div style={{ backgroundColor: '#FEF2F2', color: '#991B1B', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                    {searchError}
                  </div>
                )}

                {/* Results Scroll List */}
                <div style={{ maxHeight: '540px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                  {suggestions.map((item, idx) => {
                    if (activeTab === 'namaste') {
                      const isSelected = selectedCode === item.code;
                      return (
                        <button
                          key={item.code + idx}
                          onClick={() => handleSelectCode(item.code)}
                          style={{
                            textAlign: 'left',
                            padding: '0.85rem 1rem',
                            backgroundColor: isSelected ? 'var(--mint-light)' : '#F8FAFC',
                            border: isSelected ? '1.5px solid var(--teal-primary)' : '1px solid var(--border-light)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--primary-navy)', fontSize: '0.9rem' }}>{item.code}</strong>
                            {item.hasEnrichedClinicalProfile && (
                              <span className="sih-badge sih-badge-teal" style={{ fontSize: '0.62rem' }}>Enriched</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-primary)', marginTop: '0.2rem' }}>
                            {item.ayurvedicTerm}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {item.englishEquivalent || item.transliteration}
                          </div>
                        </button>
                      );
                    } else {
                      const code = parseItemCode(item);
                      const label = parseItemLabel(item);
                      const isSelected = selectedCode === code;
                      return (
                        <button
                          key={(item.id || code) + idx}
                          onClick={() => handleSelectCode(code, item.id || item.entityId)}
                          style={{
                            textAlign: 'left',
                            padding: '0.85rem 1rem',
                            backgroundColor: isSelected ? 'var(--mint-light)' : '#F8FAFC',
                            border: isSelected ? '1.5px solid var(--teal-primary)' : '1px solid var(--border-light)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--primary-navy)', fontSize: '0.9rem' }}>{code}</strong>
                            <span className="sih-badge sih-badge-green" style={{ fontSize: '0.62rem' }}>ICD-11</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                            {label}
                          </div>
                        </button>
                      );
                    }
                  })}

                  {!isSearching && query && suggestions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No matching classification codes found for "{query}".
                    </div>
                  )}

                  {!query && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Type a term or code above to search through the standardized medical library.
                    </div>
                  )}
                </div>
              </div>

          {/* Right Column: Encyclopedia detail — capped at left-box depth,
              full depth only via the dropdown toggle below. */}
          <div ref={detailCardRef} className="sih-card dir-detail-card">
            <div
              ref={detailBodyRef}
              className={`dir-detail-body${!detailExpanded && hasDetailContent ? ' is-collapsed' : ''}`}
            >
            {isLoadingRecord ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
                <h4 style={{ color: 'var(--primary-navy)', margin: 0 }}>Loading encyclopedia entry & WHO verification…</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Resolving clean definitions, symptoms, bidirectional ICD ↔ NAMASTE cross-mappings and official WHO links.
                </p>
              </div>
            ) : record ? (
              <EncyclopediaDetail record={record} onOpenNamaste={openNamasteRecord} onOpenIcd={openIcdRecord} />
            ) : featuredLoading ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading featured clinical records…</p>
              </div>
            ) : featuredRecords.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {featuredRecords.map((featuredRecord, index) => (
                  <div key={featuredRecord.code || featuredRecord.namasteCode || index}>
                    {index > 0 && <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '2rem', marginBottom: '1rem', color: 'var(--teal-primary)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next featured condition</div>}
                    <EncyclopediaDetail record={featuredRecord} onOpenNamaste={openNamasteRecord} onOpenIcd={openIcdRecord} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '3rem 1rem', maxWidth: '460px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><BookOpen size={40} /></div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-navy)', margin: '0 0 0.4rem' }}>
                  Disease encyclopedia
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                  Select any NAMASTE Ayurveda term or WHO ICD-11 entity to view its clean definition, symptom table, Samprapti/Chikitsa, bidirectional ICD ↔ NAMASTE mapping, and official WHO verification link.
                </p>
              </div>
            )}
          </div>
            {detailClipped && (
              <button
                type="button"
                onClick={toggleDetail}
                aria-expanded={detailExpanded}
                className="dir-detail-toggle"
              >
                {detailExpanded ? (
                  <>Show less <ChevronUp size={16} /></>
                ) : (
                  <>Show full details <ChevronDown size={16} /></>
                )}
              </button>
            )}

              </div>
            </div>
          </main>
        </div>
      </div>

      {!embedded && <ChatbotFAB />}
    </div>
  );
}
