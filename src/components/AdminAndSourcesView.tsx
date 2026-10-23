import React from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Plus,
  ExternalLink,
  Search,
  Cpu,
} from 'lucide-react';
import {
  AuditLogRecord,
  CountryCoverageMetric,
  FetchAttemptRecord,
  JobQueueItemRecord,
  ResearchRunRecord,
  SourceRegistryRecord,
  SourceSnapshotRecord,
  SystemHealthRecord,
} from '../lib/types';

interface AdminAndSourcesViewProps {
  mode: 'governance' | 'sources' | 'jobs' | 'admin';
  userRole: string;
  sources: SourceRegistryRecord[];
  countryCoverage?: CountryCoverageMetric[];
  fetchAttempts: FetchAttemptRecord[];
  snapshots: SourceSnapshotRecord[];
  jobQueue: JobQueueItemRecord[];
  researchRuns: ResearchRunRecord[];
  systemHealth: SystemHealthRecord;
  auditLogs: AuditLogRecord[];
  onTriggerDiscoveryRun: () => Promise<void>;
  onRefreshBootstrap: () => Promise<void>;
  runningDiscovery: boolean;
}

export const AdminAndSourcesView: React.FC<AdminAndSourcesViewProps> = ({
  mode,
  userRole,
  sources,
  countryCoverage = [],
  fetchAttempts,
  snapshots,
  jobQueue,
  researchRuns,
  systemHealth,
  auditLogs,
  onTriggerDiscoveryRun,
  onRefreshBootstrap,
  runningDiscovery,
}) => {
  const [subTab, setSubTab] = React.useState<'sources' | 'jobs' | 'admin'>(
    mode === 'jobs' ? 'jobs' : mode === 'admin' ? 'admin' : 'sources'
  );
  const [countryFilter, setCountryFilter] = React.useState<string>('ALL');

  React.useEffect(() => {
    if (mode === 'jobs') setSubTab('jobs');
    else if (mode === 'admin') setSubTab('admin');
    else if (mode === 'sources') setSubTab('sources');
  }, [mode]);

  // New Source Form State
  const [newName, setNewName] = React.useState('');
  const [newUrl, setNewUrl] = React.useState('');
  const [newCountry, setNewCountry] = React.useState('Germany');
  const [newCategory, setNewCategory] = React.useState('UNIVERSITY_SCHOLARSHIP');
  const [newPolicy, setNewPolicy] = React.useState('DAILY');
  const [adminError, setAdminError] = React.useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = React.useState<string | null>(null);

  // Optional Grounded Search & High-Thinking Evaluator State
  const [searchQuery, setSearchQuery] = React.useState(
    'DAAD EPOS & Max Planck IMPRS Computer Science and Microbiology doctoral scholarships for Pakistani students 2026-2027'
  );
  const [searchResult, setSearchResult] = React.useState<{
    model: string;
    answer: string;
    citations: Array<{ title: string; uri: string }>;
  } | null>(null);
  const [searching, setSearching] = React.useState(false);

  const [thinkingPrompt, setThinkingPrompt] = React.useState(
    'Compare the eligibility and funding trade-offs between Gates Cambridge (UK), Max Planck IMPRS (Germany), Fulbright USEFP (USA), MEXT (Japan), and ANSO/CSC (China) for a Pakistani applicant with a 3.88/4.0 CGPA and IELTS 8.0.'
  );
  const [thinkingResult, setThinkingResult] = React.useState<{
    model: string;
    thinkingLevel: string;
    analysis: string;
  } | null>(null);
  const [thinkingLoading, setThinkingLoading] = React.useState(false);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          seedUrl: newUrl,
          country: newCountry,
          category: newCategory,
          refreshPolicy: newPolicy,
          authorityLevel: 'PRIMARY_OFFICIAL',
          rateLimitPerMinute: 10,
          maxConcurrency: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add source');
      setNewName('');
      setNewUrl('');
      setAdminSuccess(`Added official source: ${data.source.name}`);
      await onRefreshBootstrap();
    } catch (err: any) {
      setAdminError(err.message);
    }
  };

  const handleToggleSource = async (id: string, enabled: boolean) => {
    setAdminError(null);
    const res = await fetch(`/api/admin/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, clearIsolation: enabled }),
    });
    if (res.ok) {
      await onRefreshBootstrap();
    } else {
      const d = await res.json();
      setAdminError(d.error || 'Failed to update source');
    }
  };

  const handleChangePriority = async (id: string, priority: 'HIGH' | 'NORMAL' | 'LOW') => {
    setAdminError(null);
    const res = await fetch(`/api/admin/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      await onRefreshBootstrap();
    } else {
      const d = await res.json();
      setAdminError(d.error || 'Failed to update source priority');
    }
  };

  const handleToggleAutomation = async (action: 'PAUSE' | 'RESUME') => {
    setAdminError(null);
    const res = await fetch('/api/admin/automation-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      await onRefreshBootstrap();
    } else {
      const d = await res.json();
      setAdminError(d.error || 'Unauthorized');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const res = await fetch(`/api/admin/jobs/${jobId}/retry`, { method: 'POST' });
    if (res.ok) await onRefreshBootstrap();
  };

  const handleToggleProviders = async (field: 'searchProviderEnabled' | 'aiProviderEnabled', val: boolean) => {
    setAdminError(null);
    const res = await fetch('/api/admin/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: val }),
    });
    if (res.ok) {
      await onRefreshBootstrap();
    } else {
      const d = await res.json();
      setAdminError(d.error || 'Failed to update provider settings');
    }
  };

  const handleRunGroundedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setAdminError(null);
    try {
      const res = await fetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search grounding request failed');
      setSearchResult(data);
    } catch (err: any) {
      setAdminError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleRunDeepThinking = async (e: React.FormEvent) => {
    e.preventDefault();
    setThinkingLoading(true);
    setAdminError(null);
    try {
      const res = await fetch('/api/ai/deep-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: thinkingPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deep thinking evaluation failed');
      setThinkingResult(data);
    } catch (err: any) {
      setAdminError(err.message);
    } finally {
      setThinkingLoading(false);
    }
  };

  const subTabNav = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('sources')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            subTab === 'sources'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          01. 5-Country Coverage & Source Registry ({sources.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('jobs')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            subTab === 'jobs'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          02. Durable Job Queue & Research Runs ({researchRuns.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('admin')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            subTab === 'admin'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          03. Admin & Scheduler Governance ({systemHealth.automationState})
        </button>
      </div>

      <button
        type="button"
        onClick={onTriggerDiscoveryRun}
        disabled={runningDiscovery}
        className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${runningDiscovery ? 'animate-spin' : ''}`} />
        <span>{runningDiscovery ? 'Executing Live 5-Country Crawl…' : 'Run Live 5-Country Discovery Now'}</span>
      </button>
    </div>
  );

  // ==========================================================================
  // SUB-VIEW 1: 5-COUNTRY COVERAGE & SOURCE REGISTRY
  // ==========================================================================
  if (subTab === 'sources') {
    const countriesCovered = Array.from(new Set(sources.map((s) => s.country)));
    const http200Count = sources.filter((s) => s.lastHttpStatus === 200).length;
    const restrictedCount = sources.filter((s) => s.lastHttpStatus && s.lastHttpStatus >= 400).length;
    const filteredSources =
      countryFilter === 'ALL'
        ? sources
        : sources.filter((s) => s.country.toLowerCase() === countryFilter.toLowerCase());

    return (
      <div className="space-y-7">
        {subTabNav}

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            5-Country Coverage Matrix, Official Source Registry & Retrieval Telemetry
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Every discovery cycle prioritizes all five mandatory destination countries: Germany, United Kingdom, United States, Japan, and China.
          </p>
        </div>

        {/* 5-Country Coverage Matrix */}
        {countryCoverage.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Mandatory 5-Country Coverage & Discovery Health Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {countryCoverage.map((cc) => (
                <div
                  key={cc.country}
                  className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{cc.country}</span>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          cc.freshnessStatus === 'Fresh (< 24h)'
                            ? 'text-emerald-700'
                            : cc.freshnessStatus === 'Recent (< 72h)'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {cc.freshnessStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">Sources (200 OK)</span>
                        <span className="font-semibold text-slate-900">
                          {cc.http200SourcesCount}/{cc.configuredSourcesCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">Restricted/Fail</span>
                        <span className="font-semibold text-amber-700">{cc.failedOrRestrictedSourcesCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">Opportunities</span>
                        <span className="font-semibold text-slate-900">{cc.opportunitiesDiscoveredCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">Fully Funded</span>
                        <span className="font-semibold text-emerald-700">{cc.fullyFundedCount}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 pt-1 font-mono">
                      CS: <strong>{cc.csOpportunitiesCount}</strong> · Micro: <strong>{cc.microbiologyOpportunitiesCount}</strong> · Jobs: {cc.pendingJobsCount}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug pt-1">
                      {cc.pakistaniPathwaySummary}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>
                      Last:{' '}
                      {cc.lastRetrievalAt ? cc.lastRetrievalAt.slice(0, 16).replace('T', ' ') : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCountryFilter(countryFilter === cc.country ? 'ALL' : cc.country)
                      }
                      className="text-slate-900 font-sans font-semibold underline"
                    >
                      {countryFilter === cc.country ? 'Show All' : 'Filter Sources'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coverage Disclosure & Telemetry Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-lg p-4">
          <div>
            <span className="text-xs text-slate-500 block">Registered Official Sources</span>
            <span className="text-lg font-bold font-mono text-slate-900">{sources.length}</span>
            <span className="text-[11px] text-slate-500 block">Across {countriesCovered.length} countries</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Live HTTP 200 Verified</span>
            <span className="text-lg font-bold font-mono text-emerald-700">{http200Count}</span>
            <span className="text-[11px] text-slate-500 block">Substantive HTML extracted</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Access Restricted (403/412)</span>
            <span className="text-lg font-bold font-mono text-amber-700">{restrictedCount}</span>
            <span className="text-[11px] text-slate-500 block">Explicitly marked Unavailable</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Discovery Coverage Mode</span>
            <span className="text-sm font-semibold text-slate-900">
              {systemHealth.searchProviderEnabled ? 'Registry + Grounded Search' : 'Official Registry + Link Crawl'}
            </span>
            <span className="text-[11px] text-slate-500 block">
              {systemHealth.searchProviderEnabled
                ? 'Optional Search Grounding active'
                : 'Paid APIs disabled by default (Bounded coverage)'}
            </span>
          </div>
        </div>

        {/* Source Country Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Filter Source Registry by Country:</span>
          {['ALL', 'Germany', 'United Kingdom', 'United States', 'Japan', 'China', 'Pakistan'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCountryFilter(c)}
              className={`px-2.5 py-1 rounded border font-medium ${
                countryFilter === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {c === 'ALL' ? `All (${sources.length})` : c}
            </button>
          ))}
        </div>

        {/* Source Registry Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 font-semibold">Official Source & Seed URL</th>
                <th className="py-3 px-4 font-semibold">Category & Country</th>
                <th className="py-3 px-4 font-semibold">Priority & Policy</th>
                <th className="py-3 px-4 font-semibold">Latest HTTP Status</th>
                <th className="py-3 px-4 font-semibold">Latency</th>
                <th className="py-3 px-4 font-semibold">Last Checked</th>
                {userRole === 'admin' && <th className="py-3 px-4 font-semibold">Control</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSources.map((src) => (
                <tr key={src.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{src.name}</div>
                    <a
                      href={src.seedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900 underline"
                    >
                      <span>{src.seedUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div className="font-semibold text-slate-900">{src.country}</div>
                    <div className="text-[11px] text-slate-500">{src.category}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    <div>
                      Priority: <strong>{src.priority || 'HIGH'}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {src.refreshPolicy} ({src.rateLimitPerMinute}/min)
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {src.lastHttpStatus === 200 ? (
                      <span className="text-emerald-700 font-semibold">HTTP 200 OK</span>
                    ) : src.lastHttpStatus ? (
                      <span className="text-red-700 font-semibold">HTTP {src.lastHttpStatus}</span>
                    ) : (
                      <span className="text-slate-400">Pending</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {src.lastResponseTimeMs !== null ? `${src.lastResponseTimeMs} ms` : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {src.lastFetchedAt ? src.lastFetchedAt.slice(0, 19).replace('T', ' ') : 'Never'}
                  </td>
                  {userRole === 'admin' && (
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Priority for ${src.name}`}
                          value={src.priority || 'HIGH'}
                          onChange={(e) =>
                            handleChangePriority(src.id, e.target.value as 'HIGH' | 'NORMAL' | 'LOW')
                          }
                          className="px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white"
                        >
                          <option value="HIGH">HIGH</option>
                          <option value="NORMAL">NORMAL</option>
                          <option value="LOW">LOW</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleToggleSource(src.id, !src.enabled)}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded hover:bg-slate-100"
                        >
                          {src.enabled ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Source Snapshots & Content Hashes */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Persisted Source Snapshots & SHA-256 Content Hashes ({snapshots.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            {snapshots.slice(0, 6).map((snap) => (
              <div key={snap.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs min-w-0 overflow-hidden">
                <div className="font-semibold text-slate-900 truncate">{snap.title || snap.normalizedUrl}</div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  URL: {snap.normalizedUrl} · Hash: {snap.contentHash.slice(0, 16)}…
                </div>
                <p className="text-slate-600 font-mono text-[11px] line-clamp-3 break-words bg-slate-50 p-2 rounded border border-slate-100">
                  {snap.extractedTextSnippet}
                </p>
                <div className="text-[11px] text-slate-500">
                  Discovered Child Official Links: <strong>{snap.discoveredChildLinks.length}</strong> · Retrieved: {snap.retrievedAt.slice(0, 19).replace('T', ' ')} UTC
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ==========================================================================
  // SUB-VIEW 2: RESEARCH ACTIVITY & DURABLE JOB MONITOR
  // ==========================================================================
  if (subTab === 'jobs') {
    return (
      <div className="space-y-7">
        {subTabNav}
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Research Activity, Durable Job Queue & Execution Logs
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            PostgreSQL-compatible job queue with atomic claiming, unique idempotency keys, processing leases, and per-domain concurrency limits.
          </p>
        </div>

        {/* Research Runs Log */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Persisted Research Run History ({researchRuns.length})
          </h2>
          <div className="space-y-3">
            {researchRuns.map((run) => (
              <div key={run.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    Run {run.id.slice(0, 8)} · Trigger: <span className="font-mono">{run.triggerType}</span> · Status:{' '}
                    <span
                      className={
                        run.status === 'COMPLETED'
                          ? 'text-emerald-700'
                          : run.status === 'DEGRADED'
                          ? 'text-amber-700'
                          : 'text-red-700'
                      }
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Started: {run.startedAt.slice(0, 19).replace('T', ' ')} UTC
                  </div>
                </div>
                <div className="font-mono text-[11px] text-slate-700">
                  Sources Checked: {run.sourcesChecked} · HTTP 200 OK: {run.httpSuccessCount} · HTTP Restricted/Failed: {run.httpFailureCount} · Claims Updated: {run.claimsExtracted} · Child Links Discovered: {run.urlsDiscovered}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 font-mono text-[11px] text-slate-600 space-y-1">
                  {run.summaryLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Durable Job Queue Table */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Durable Job Queue Items & Lease Telemetry ({jobQueue.length})
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Idempotency Key</th>
                  <th className="py-2.5 px-3 font-semibold">Domain & Type</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Attempts</th>
                  <th className="py-2.5 px-3 font-semibold">Latest Log / Error</th>
                  {userRole === 'admin' && <th className="py-2.5 px-3 font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobQueue.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">{j.idempotencyKey}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {j.targetDomain} · {j.jobType}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      <span
                        className={
                          j.status === 'COMPLETED'
                            ? 'text-emerald-700'
                            : j.status === 'QUEUED' || j.status === 'PROCESSING'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {j.attempts}/{j.maxAttempts}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {j.lastError || j.executionLog[j.executionLog.length - 1] || '—'}
                    </td>
                    {userRole === 'admin' && (
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleRetryJob(j.id)}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded hover:bg-slate-100"
                        >
                          Retry Job
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ==========================================================================
  // SUB-VIEW 3: ADMINISTRATIVE CONTROLS & SYSTEM HEALTH
  // ==========================================================================
  return (
    <div className="space-y-7">
      {subTabNav}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Administrative Controls, Scheduler Governance & Optional Provider Interfaces
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Role-protected system controls (`role: {userRole}`). Manage automation state, onboard official sources with SSRF validation, and configure optional AI/Search providers.
        </p>
      </div>

      {adminError && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {adminError}
        </div>
      )}
      {adminSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {adminSuccess}
        </div>
      )}

      {userRole !== 'admin' ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-xs text-amber-900 space-y-2">
          <div className="font-semibold text-sm">Administrator Role Required (HTTP 403 Protected)</div>
          <p>
            You are currently signed in as a standard student account. Switch back to the primary Pakistani Administrator/Researcher account (<strong>Zainab Raza</strong>) via the top-right Account Switcher to modify system automation, onboard new source domains, or view security audit logs.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Automation State & Resource Consumption */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  01. Automation Scheduler State & Free-Tier Resource Telemetry
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Current State: <strong className="font-mono">{systemHealth.automationState}</strong> — {systemHealth.stateReason}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {systemHealth.automationState === 'Paused' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation('RESUME')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Daily Automation</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation('PAUSE')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Automation</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 font-sans block">Cron Schedule</span>
                <span className="font-semibold text-slate-900">{systemHealth.cronSchedule} (Daily)</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Total HTTP Requests</span>
                <span className="font-semibold text-slate-900">{systemHealth.totalRequestsMade}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Total Bytes Fetched</span>
                <span className="font-semibold text-slate-900">
                  {(systemHealth.totalBytesFetched / 1024).toFixed(1)} KB
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Last Successful Run</span>
                <span className="font-semibold text-slate-900">
                  {systemHealth.lastSuccessfulRunAt
                    ? systemHealth.lastSuccessfulRunAt.slice(0, 19).replace('T', ' ')
                    : 'Pending'}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Onboard Official Source (with SSRF Validation) */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              02. Onboard Authoritative Official Source Domain (SSRF Protected)
            </h2>
            <form onSubmit={handleAddSource} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Official Organization & Page Name"
                aria-label="Official Source Name"
                className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://official-university.edu/scholarships"
                aria-label="Official Seed URL"
                className="sm:col-span-2 px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
              />
              <input
                type="text"
                required
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="Country"
                aria-label="Source Country"
                className="px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                aria-label="Source Category"
                className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="UNIVERSITY_SCHOLARSHIP">University Scholarship Portal</option>
                <option value="UNIVERSITY_DIRECTORY">University Graduate Directory</option>
                <option value="GOVERNMENT_PORTAL">Government Scholarship Portal</option>
                <option value="NATIONAL_AGENCY">National Scholarship Agency</option>
                <option value="FELLOWSHIP_PROGRAM">Official Fellowship Program</option>
                <option value="DEPARTMENT_LAB">Department / Research Lab</option>
              </select>
              <select
                value={newPolicy}
                onChange={(e) => setNewPolicy(e.target.value)}
                aria-label="Refresh Policy"
                className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="DAILY">Refresh Daily (Deadline-Sensitive)</option>
                <option value="EVERY_3_DAYS">Refresh Every 3 Days</option>
                <option value="WEEKLY">Refresh Weekly</option>
                <option value="MONTHLY">Refresh Monthly</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Official Source</span>
              </button>
            </form>
          </section>

          {/* 3. Optional Provider Interfaces (Google Search Grounding & High-Thinking) */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-sm font-semibold text-slate-900">
                03. Optional Provider Interfaces (Section 3 Provider Policy — Disabled by Default)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Core discovery, verification, funding analysis, and eligibility operate 100% deterministically without runtime AI calls. Enable optional providers below to run live Google Search Grounding (`gemini-3.8-flash`) or High-Thinking reasoning (`gemini-4-argon` with `ThinkingLevel.HIGH`).
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemHealth.searchProviderEnabled}
                  onChange={(e) => handleToggleProviders('searchProviderEnabled', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-semibold text-slate-900">
                  Enable Google Search Grounding (`gemini-3.8-flash` + `googleSearch`)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemHealth.aiProviderEnabled}
                  onChange={(e) => handleToggleProviders('aiProviderEnabled', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-semibold text-slate-900">
                  Enable High-Thinking Evaluator (`gemini-4-argon` + `ThinkingLevel.HIGH`)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Grounded Search Box */}
              <form onSubmit={handleRunGroundedSearch} className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Grounded Official-Source Web Search (`gemini-3.8-flash`)</span>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Grounded Search Query"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  {searching ? 'Searching Official Web Sources…' : 'Execute Grounded Search'}
                </button>
                {searchResult && (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded text-xs space-y-2">
                    <div className="font-mono text-[11px] text-slate-500">Model: {searchResult.model}</div>
                    <p className="text-slate-800 whitespace-pre-line">{searchResult.answer}</p>
                    {searchResult.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="font-semibold text-[11px] text-slate-600">Grounded Citations:</div>
                        {searchResult.citations.map((c, i) => (
                          <a
                            key={i}
                            href={c.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11px] font-mono text-slate-700 underline truncate"
                          >
                            {c.title} — {c.uri}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>

              {/* High Thinking Box */}
              <form onSubmit={handleRunDeepThinking} className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Complex Strategy Evaluator (`gemini-4-argon` · `ThinkingLevel.HIGH`)</span>
                </div>
                <textarea
                  rows={2}
                  value={thinkingPrompt}
                  onChange={(e) => setThinkingPrompt(e.target.value)}
                  aria-label="High Thinking Evaluation Prompt"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  disabled={thinkingLoading}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  {thinkingLoading ? 'Reasoning with ThinkingLevel.HIGH…' : 'Run High-Thinking Analysis'}
                </button>
                {thinkingResult && (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded text-xs space-y-2">
                    <div className="font-mono text-[11px] text-slate-500">
                      Model: {thinkingResult.model} · ThinkingLevel: {thinkingResult.thinkingLevel}
                    </div>
                    <p className="text-slate-800 whitespace-pre-line">{thinkingResult.analysis}</p>
                  </div>
                )}
              </form>
            </div>
          </section>

          {/* 4. Security Audit Logs */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              04. Redacted Security & Operational Audit Logs ({auditLogs.length})
            </h2>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs font-mono">
              {auditLogs.slice(0, 30).map((log) => (
                <div key={log.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900">{log.action}</span>{' '}
                    <span className="text-slate-500">[{log.targetType}]</span> —{' '}
                    <span className="text-slate-700">{log.details}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {log.createdAt.slice(0, 19).replace('T', ' ')} UTC
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
