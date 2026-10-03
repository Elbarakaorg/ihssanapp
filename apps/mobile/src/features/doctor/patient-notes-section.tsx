import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { type PatientNote, addPatientNote, deletePatientNote, listPatientNotes, updatePatientNote } from '@/features/doctor/doctor-api';
import { Button, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { useScheme } from '@/ui/palette';

export function PatientNotesSection({ grantId }: { grantId: string }) {
  useScheme();
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setNotes(await listPatientNotes(grantId)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load notes.'); }
  }, [grantId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true); setError('');
    try {
      if (editingId) await updatePatientNote(editingId, draft); else await addPatientNote(grantId, draft);
      setDraft(''); setEditingId('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the note.'); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setError('');
    try { await deletePatientNote(id); if (editingId === id) { setEditingId(''); setDraft(''); } await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the note.'); }
  };

  return (
    <View>
      <Text style={s.section}>My private notes</Text>
      <Text style={s.meta}>Only you can see these notes. They are not shared with the patient or Ihssan staff, and they are hidden if the patient revokes access.</Text>
      {error ? <Message kind="error">{error}</Message> : null}
      <Field label={editingId ? 'Edit note' : 'New note'} value={draft} onChangeText={setDraft} multiline maxLength={4000} />
      <Button label={editingId ? 'Update note' : 'Add note'} busy={busy} disabled={!draft.trim()} onPress={() => void save()} />
      {editingId ? <Button label="Cancel edit" tone="secondary" onPress={() => { setEditingId(''); setDraft(''); }} /> : null}
      {notes.map((n) => (
        <View key={n.id} style={s.card}>
          <Text style={s.meta}>{new Date(n.created_at).toLocaleString()}{n.updated_at !== n.created_at ? ' · edited' : ''}</Text>
          <Text style={s.cardTitle}>{n.body}</Text>
          <View style={s.row}>
            <Button label="Edit" tone="secondary" onPress={() => { setEditingId(n.id); setDraft(n.body); }} />
            <Button label="Delete" tone="danger" onPress={() => void remove(n.id)} />
          </View>
        </View>
      ))}
    </View>
  );
}
