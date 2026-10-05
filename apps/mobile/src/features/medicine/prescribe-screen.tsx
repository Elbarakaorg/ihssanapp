import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { BackLink, Message } from '@/features/doctor/ui';
import { prescribeTreatment } from '@/features/medicine/repository';
import { TreatmentForm } from '@/features/medicine/treatment-form';
import { Page, PageHeading } from '@/ui/patient-ui';
import { useScheme } from '@/ui/palette';

export default function PrescribeScreen() {
  useScheme();
  const router = useRouter();
  const { grantId = '' } = useLocalSearchParams<{ grantId: string }>();
  return (
    <Page>
      <BackLink href={`/my-patients/${grantId}` as Href} label="Patient" />
      <PageHeading eyebrow="Clinician" title="Prescribe a treatment">Select medicines from the directory, set when the patient takes them, and name the treatment.</PageHeading>
      {grantId ? <TreatmentForm onSubmit={async (input) => { await prescribeTreatment(grantId, input); router.replace(`/my-patients/${grantId}` as Href); }} prescribe submitLabel="Prescribe to patient" /> : <Message kind="error">Open this from a patient profile.</Message>}
    </Page>
  );
}
