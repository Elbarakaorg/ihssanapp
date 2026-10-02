export type SupportInvitationMailer = {
  send(input: { email: string }): Promise<void>;
};

type ResendConfiguration = {
  apiKey?: string;
  fromEmail?: string;
  signupUrl?: string;
};

export function createResendInvitationMailer(configuration: ResendConfiguration): SupportInvitationMailer | null {
  const { apiKey, fromEmail, signupUrl } = configuration;
  if (!apiKey || !fromEmail || !signupUrl) return null;

  return {
    async send({ email }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'You have been invited to Ihssan administration',
          text: `You have been invited to the Ihssan administration workspace. Create or confirm an Ihssan account using this email, then sign in to the admin portal. ${signupUrl}`,
          html: `<p>You have been invited to the <strong>Ihssan administration</strong> workspace.</p><p>Create or confirm an Ihssan account using this email, then sign in to the admin portal.</p><p><a href="${signupUrl}">Open Ihssan</a></p>`,
        }),
      });

      if (!response.ok) throw new Error('Resend rejected the invitation email.');
    },
  };
}