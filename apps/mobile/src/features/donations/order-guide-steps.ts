export type GuideStepKey = 'copy' | 'send' | 'save' | 'upload' | 'name' | 'counted';
export type GuideStep = { key: GuideStepKey; title: string; body: string };

// `**text**` marks the words to emphasise.
export const GUIDE_STEPS: GuideStep[] = [
  { key: 'copy', title: 'Copy the bank details', body: '**Tap any row** to copy it. Copy the **account number** and the **transfer reference**.' },
  { key: 'send', title: 'Send your transfer', body: 'In your bank app, **paste the details** and send the **exact amount**. Put the **reference** in the message.' },
  { key: 'save', title: 'Save your receipt', body: 'Take a **screenshot** of the confirmation, or save the **PDF**. You will need it in a moment.' },
  { key: 'upload', title: 'Upload your receipt', body: 'Come back here, tap **Upload receipt & confirm donation**, then choose your screenshot.' },
  { key: 'name', title: 'No receipt? Use the account name', body: 'Tap **I paid but have no receipt**, type the **name on the account** you paid from, then tap **Confirm**.' },
  { key: 'counted', title: 'Your donation is counted', body: 'A fund collector checks the transfer. Once **confirmed**, your gift shows on the case and the **progress bar moves**.' },
];

export function splitEmphasis(text: string) {
  return text.split('**').map((part, index) => ({ text: part, strong: index % 2 === 1 })).filter((part) => part.text);
}
