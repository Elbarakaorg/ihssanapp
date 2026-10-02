import { useState } from 'react';
import { Check, CircleAlert, FilePlus2, LoaderCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import type { AdminMembership } from '../../lib/permission';
import { supabase } from '../../lib/supabase';

type MetricDefinition = {
  id: string;
  metric_key: string;
  version: number;
  display_names: Record<string, string>;
  supported_units: string[];
  category: string;
  value_shape: Record<string, unknown>;
  is_active: boolean;
};

type EvidenceSource = { title: string; url: string };
type MetricContent = {
  id: string;
  metric_definition_id: string;
  locale: 'en' | 'fr' | 'ar';
  content: Record<string, string>;
  reference_ranges: unknown[] | null;
  evidence_sources: EvidenceSource[];
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'retired';
  authored_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
};

type CatalogData = { definitions: MetricDefinition[]; versions: MetricContent[] };
type MetricEditorDraft = { content: Record<string, string>; rangesText: string; sourcesText: string; reviewNotes: string };
type DefinitionEditorDraft = { names: Record<string, string>; unitsText: string };
type Props = { membership: AdminMembership; session: Session };
const locales = ['en', 'fr', 'ar'] as const;
const contentFields = [
  ['title', 'Patient-facing title'],
  ['summary', 'Short explanation'],
  ['short_explanation', 'What this measurement is'],
  ['detailed_explanation', 'Detailed explanation'],
  ['how_to_read', 'How to read your result'],
  ['entry_guidance', 'Recording guidance'],
  ['safety_note', 'Safety note'],
] as const;

export default function MetricCatalogPage({ membership, session }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [locale, setLocale] = useState<(typeof locales)[number]>('en');
  const [editorDraft, setEditorDraft] = useState<MetricEditorDraft | null>(null);
  const [definitionDraft, setDefinitionDraft] = useState<DefinitionEditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canEdit = membership.role === 'platform_owner' || membership.permissions.includes('metrics.edit');
  const canReview = membership.role === 'platform_owner' || membership.permissions.includes('metrics.review');
  const canPublish = membership.role === 'platform_owner' || membership.permissions.includes('metrics.publish');

  const catalogQuery = useQuery({
    queryKey: ['metric-catalog'],
    queryFn: async (): Promise<CatalogData> => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: definitions, error: definitionsError } = await supabase
        .from('metric_definitions')
        .select('id,metric_key,version,display_names,supported_units,category,value_shape,is_active')
        .order('metric_key')
        .order('version', { ascending: false });
      if (definitionsError) throw definitionsError;

      const definitionIds = (definitions ?? []).map((definition) => definition.id as string);
      if (!definitionIds.length) return { definitions: [], versions: [] };
      const { data: versions, error: versionsError } = await supabase
        .from('metric_content_versions')
        .select('id,metric_definition_id,locale,content,reference_ranges,evidence_sources,status,authored_by,reviewed_by,review_notes')
        .in('metric_definition_id', definitionIds)
        .order('created_at', { ascending: false });
      if (versionsError) throw versionsError;
      return { definitions: definitions as MetricDefinition[], versions: versions as MetricContent[] };
    },
  });

  const definitions = catalogQuery.data?.definitions ?? [];
  const selectedDefinition = definitions.find((definition) => definition.id === selectedId) ?? definitions[0] ?? null;
  const versions = catalogQuery.data?.versions ?? [];
  const selectedVersion = selectedDefinition
    ? versions.find((version) => version.metric_definition_id === selectedDefinition.id && version.locale === locale && version.status !== 'retired') ?? null
    : null;
  const currentDraft = editorDraft ?? {
    content: selectedVersion?.content ?? {},
    rangesText: selectedVersion?.reference_ranges ? JSON.stringify(selectedVersion.reference_ranges, null, 2) : '',
    sourcesText: (selectedVersion?.evidence_sources ?? []).map((source) => `${source.title} | ${source.url}`).join('\n'),
    reviewNotes: selectedVersion?.review_notes ?? '',
  };
  const currentDefinitionDraft = definitionDraft ?? {
    names: selectedDefinition?.display_names ?? {},
    unitsText: selectedDefinition?.supported_units.join(', ') ?? '',
  };
  const canEditSelected = canEdit && (!selectedVersion || selectedVersion.status === 'draft' && (!selectedVersion.authored_by || selectedVersion.authored_by === session.user.id));

  const saveDraft = async () => {
    if (!supabase || !selectedDefinition || !canEditSelected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const referenceRanges = currentDraft.rangesText.trim() ? JSON.parse(currentDraft.rangesText) : null;
      if (referenceRanges !== null && !Array.isArray(referenceRanges)) throw new Error('Reference ranges must be a JSON array.');
      const evidenceSources = currentDraft.sourcesText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const separator = line.indexOf('|');
        if (separator < 1) throw new Error('Each source must use: Title | https://source.example');
        const title = line.slice(0, separator).trim();
        const url = line.slice(separator + 1).trim();
        if (!/^https:\/\//.test(url)) throw new Error('Evidence source URLs must use HTTPS.');
        return { title, url };
      });
      let versionId = selectedVersion?.id;
      const content = currentDraft.content;
      if (versionId) {
        const { error: updateError } = await supabase.from('metric_content_versions').update({
          content,
          reference_ranges: referenceRanges,
          evidence_sources: evidenceSources,
          authored_by: session.user.id,
        }).eq('id', versionId).eq('status', 'draft');
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from('metric_content_versions').insert({
          metric_definition_id: selectedDefinition.id,
          locale,
          content,
          reference_ranges: referenceRanges,
          evidence_sources: evidenceSources,
          status: 'draft',
          authored_by: session.user.id,
        }).select('id').single();
        if (insertError) throw insertError;
        versionId = data.id as string;
      }
      await catalogQuery.refetch();
      setEditorDraft(null);
      setNotice(`Draft saved for ${selectedDefinition.display_names.en ?? selectedDefinition.metric_key} (${locale.toUpperCase()}).`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save metric content.');
    } finally {
      setSaving(false);
    }
  };

  const saveDefinition = async () => {
    if (!supabase || !selectedDefinition || !canEdit) return;
    const names = Object.fromEntries(locales.map((item) => [item, currentDefinitionDraft.names[item]?.trim() ?? '']));
    const units = currentDefinitionDraft.unitsText.split(',').map((unit) => unit.trim()).filter(Boolean);
    if (Object.values(names).some((name) => !name) || !units.length) {
      setError('Provide a display name in all three languages and at least one supported unit.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (selectedDefinition.is_active) {
        const { data, error: rpcError } = await supabase.rpc('create_metric_definition_draft', {
          target_definition_id: selectedDefinition.id,
          requested_display_names: names,
          requested_supported_units: units,
          requested_value_shape: selectedDefinition.value_shape,
        });
        if (rpcError) throw rpcError;
        await catalogQuery.refetch();
        setSelectedId(data as string);
        setDefinitionDraft(null);
        setEditorDraft(null);
        setNotice('A new inactive definition version was created. Edit its localized content and submit it for review.');
      } else {
        const { error: updateError } = await supabase.from('metric_definitions').update({
          display_names: names,
          supported_units: units,
        }).eq('id', selectedDefinition.id).eq('is_active', false);
        if (updateError) throw updateError;
        await catalogQuery.refetch();
        setDefinitionDraft(null);
        setNotice('Metric definition draft saved.');
      }
    } catch (definitionError) {
      setError(definitionError instanceof Error ? definitionError.message : 'Could not save this metric definition.');
    } finally {
      setSaving(false);
    }
  };

  const runWorkflowAction = async (action: 'submit' | 'approve' | 'return' | 'publish') => {
    if (!supabase || !selectedVersion) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (action === 'submit') {
        const { error: rpcError } = await supabase.rpc('submit_metric_content_for_review', { target_version_id: selectedVersion.id });
        if (rpcError) throw rpcError;
      } else if (action === 'approve' || action === 'return') {
        const { error: rpcError } = await supabase.rpc('review_metric_content_version', {
          target_version_id: selectedVersion.id,
          approve: action === 'approve',
          notes: currentDraft.reviewNotes,
        });
        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('publish_metric_content_version', { target_version_id: selectedVersion.id });
        if (rpcError) throw rpcError;
      }
      await catalogQuery.refetch();
      setEditorDraft(null);
      setNotice(action === 'submit' ? 'Draft submitted for clinician review.' : action === 'approve' ? 'Metric content approved.' : action === 'return' ? 'Metric content returned to the author.' : 'Metric content published.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The workflow action could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">CLINICAL CONTENT</p><h1>Metric Catalog</h1><p className="page-lede">Versioned patient explanations, source evidence, and clinician-reviewed ranges. Nothing is shown to patients until published.</p></div><button className="button button-secondary" onClick={() => void catalogQuery.refetch()} disabled={catalogQuery.isFetching}><RefreshCw size={15} /> Refresh</button></header>
      {error || catalogQuery.error ? <div className="alert alert-error" role="alert">{error || (catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Could not load metric content.')}</div> : null}
      {notice ? <div className="alert alert-success" role="status">{notice}</div> : null}
      <div className="metric-editor-layout">
        <aside className="panel metric-list-panel">
          <div className="section-heading"><div><h2>Definitions</h2><p>Choose a metric and language.</p></div></div>
          {catalogQuery.isLoading ? <div className="loading-state"><LoaderCircle className="spin" size={17} /> Loading metrics</div> : definitions.map((definition) => (
            <button className={`metric-select${(selectedDefinition?.id === definition.id) ? ' metric-select-active' : ''}`} key={definition.id} onClick={() => { setSelectedId(definition.id); setEditorDraft(null); setDefinitionDraft(null); }}>
              <span><strong>{definition.display_names.en ?? definition.metric_key}</strong><small>{definition.category} · {definition.metric_key} · v{definition.version}</small></span>
              <span className={`status ${definition.is_active ? 'status-open' : 'status-closed'}`}>{definition.is_active ? 'Active' : 'Draft'}</span>
            </button>
          ))}
        </aside>
        {selectedDefinition ? <section className="panel metric-editor-panel">
          <div className="panel-heading panel-heading-spread"><div><h2>{selectedDefinition.display_names.en ?? selectedDefinition.metric_key}</h2><p>Supported units: {selectedDefinition.supported_units.join(', ') || 'Not specified'}</p></div><span className={`status ${selectedVersion?.status === 'published' ? 'status-open' : 'status-closed'}`}>{selectedVersion?.status ?? 'No content'}</span></div>
          <details className="definition-editor"><summary>Metric definition · version {selectedDefinition.version}{selectedDefinition.is_active ? ' · active' : ' · draft'}</summary><div className="definition-fields">{locales.map((item) => <label className="metric-field" key={item}><span>{item.toUpperCase()} display name</span><input disabled={!canEdit} onChange={(event) => setDefinitionDraft({ ...currentDefinitionDraft, names: { ...currentDefinitionDraft.names, [item]: event.target.value } })} value={currentDefinitionDraft.names[item] ?? ''} /></label>)}<label className="metric-field"><span>Supported units (comma-separated)</span><input disabled={!canEdit} onChange={(event) => setDefinitionDraft({ ...currentDefinitionDraft, unitsText: event.target.value })} value={currentDefinitionDraft.unitsText} /></label></div>{canEdit ? <button className="button button-secondary" disabled={saving} onClick={() => void saveDefinition()}>{selectedDefinition.is_active ? 'Create new definition version' : 'Save definition draft'}</button> : null}</details>
          <div className="locale-tabs" role="tablist" aria-label="Content language">{locales.map((item) => <button aria-selected={locale === item} className={locale === item ? 'locale-tab locale-tab-active' : 'locale-tab'} key={item} onClick={() => { setLocale(item); setEditorDraft(null); }} role="tab">{item.toUpperCase()}</button>)}</div>
          {selectedVersion?.review_notes ? <div className="review-note"><CircleAlert size={15} /><span>{selectedVersion.review_notes}</span></div> : null}
          <div className="metric-fields">{contentFields.map(([key, label]) => <label className="metric-field" key={key}><span>{label}</span><textarea disabled={!canEditSelected} onChange={(event) => setEditorDraft({ ...currentDraft, content: { ...currentDraft.content, [key]: event.target.value } })} rows={key === 'detailed_explanation' || key === 'safety_note' ? 5 : 3} value={currentDraft.content[key] ?? ''} /></label>)}
            <label className="metric-field"><span>Reference ranges (JSON array, clinician-reviewed)</span><textarea disabled={!canEditSelected} onChange={(event) => setEditorDraft({ ...currentDraft, rangesText: event.target.value })} placeholder="Leave blank until evidence and clinical context are approved." rows={5} value={currentDraft.rangesText} /></label>
            <label className="metric-field"><span>Evidence sources (one per line: title | HTTPS URL)</span><textarea disabled={!canEditSelected} onChange={(event) => setEditorDraft({ ...currentDraft, sourcesText: event.target.value })} rows={4} value={currentDraft.sourcesText} /></label>
          </div>
          {canReview && selectedVersion?.status === 'in_review' ? <label className="metric-field review-notes-field"><span>Reviewer notes</span><textarea onChange={(event) => setEditorDraft({ ...currentDraft, reviewNotes: event.target.value })} rows={3} value={currentDraft.reviewNotes} /></label> : null}
          {!canEdit ? <p className="form-help">You have read-only access to metric content.</p> : null}
          {selectedVersion && selectedVersion.status === 'in_review' ? <p className="form-help">Review is restricted to a different active verified clinician with the review permission.</p> : null}
          <div className="metric-actions">
            {canEditSelected ? <button className="button button-secondary" disabled={saving} onClick={() => void saveDraft()}><FilePlus2 size={15} /> Save draft</button> : null}
            {canEditSelected && selectedVersion?.status === 'draft' && selectedVersion.authored_by === session.user.id ? <button className="button button-primary" disabled={saving} onClick={() => void runWorkflowAction('submit')}><Send size={15} /> Submit for review</button> : null}
            {canReview && selectedVersion?.status === 'in_review' ? <><button className="button button-secondary" disabled={saving} onClick={() => void runWorkflowAction('return')}>Return to author</button><button className="button button-primary" disabled={saving} onClick={() => void runWorkflowAction('approve')}><Check size={15} /> Approve</button></> : null}
            {canPublish && selectedVersion?.status === 'approved' ? <button className="button button-primary" disabled={saving} onClick={() => void runWorkflowAction('publish')}><ShieldCheck size={15} /> Publish</button> : null}
          </div>
          {canPublish && selectedVersion?.status === 'published' && !selectedDefinition.is_active ? <button className="button button-primary definition-publish" disabled={saving} onClick={async () => { if (!supabase) return; setSaving(true); setError(''); try { const { error: rpcError } = await supabase.rpc('publish_metric_definition', { target_definition_id: selectedDefinition.id }); if (rpcError) throw rpcError; await catalogQuery.refetch(); setNotice('Metric definition version activated.'); } catch (publishError) { setError(publishError instanceof Error ? publishError.message : 'Could not activate metric definition.'); } finally { setSaving(false); } }}><ShieldCheck size={15} /> Activate definition version</button> : null}
        </section> : <div className="empty-state">No metric definitions are available.</div>}
      </div>
      <section className="panel metric-governance-note"><ShieldCheck size={17} /><p>Patient charts show published explanations only. Reference ranges are deliberately blank until a verified clinician adds evidence, population, context, and approval.</p></section>
    </div>
  );
}