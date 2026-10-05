import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { BackLink, Message } from '@/features/doctor/ui';
import { listMyTreatments, saveMyTreatment } from '@/features/medicine/repository';
import type { Treatment } from '@/features/medicine/schedule';
import { TreatmentForm } from '@/features/medicine/treatment-form';
import { useAuth } from '@/features/auth/auth-provider';
import { Loading } from '@/ui/loading';
import { Page, PageHeading } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';

export default function TreatmentEditScreen() {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const { id, medicine } = useLocalSearchParams<{ id?: string; medicine?: string }>();
  const [initial, setInitial] = useState<Treatment | undefined>();
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !session) return;
    listMyTreatments().then((all) => {
      const found = all.find((t) => t.id === id);
      if (!found || found.prescribed) setError('This treatment cannot be edited.');
      else setInitial(found);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Could not load this treatment.')).finally(() => setLoading(false));
  }, [id, session]);

  return (
    <Page>
      <BackLink href={'/treatments' as Href} label="Treatments" />
      <PageHeading eyebrow="Daily care" title={id ? 'Edit treatment' : 'New treatment'}>Choose your medicines and when you take them.</PageHeading>
      {!session ? <Message kind="info">Sign in to create a treatment.</Message>
        : loading ? <Loading label="Loading treatment" inline />
        : error ? <Message kind="error">{error}</Message>
        : <TreatmentForm initial={initial} onSubmit={async (input) => { await saveMyTreatment(input); router.replace('/treatments' as Href); }} presetMedicine={medicine} submitLabel={id ? 'Save changes' : 'Save treatment'} />}
    </Page>
  );
}
