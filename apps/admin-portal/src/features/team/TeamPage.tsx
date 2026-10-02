import { useState } from 'react';
import { Check, LoaderCircle, RefreshCw, Shield, UserPlus, UserRoundX } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { adminApi, permissionOptions, type AdminMembership, type AdminPermission } from '../../lib/admin-api';

type Props = { session: Session };

type SupportInvitation = {
  id: string;
  email_normalized: string;
  permissions: string[];
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

type TeamData = { memberships: AdminMembership[]; invitations: SupportInvitation[] };
type InvitationResponse = { invitationId: string; delivery: 'sent' | 'not_configured' | 'failed' };

export default function TeamPage({ session }: Props) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [permissions, setPermissions] = useState<AdminPermission[]>(['support.requests.manage']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<AdminPermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const teamQuery = useQuery({
    queryKey: ['admin-team', session.user.id],
    queryFn: async () => {
      const [membershipResult, invitationResult] = await Promise.all([
        adminApi<{ memberships: AdminMembership[] }>('/v1/admin/memberships', session.access_token),
        adminApi<{ invitations: SupportInvitation[] }>('/v1/admin/invitations', session.access_token),
      ]);
      return { memberships: membershipResult.memberships, invitations: invitationResult.invitations } as TeamData;
    },
  });
  const memberships = teamQuery.data?.memberships ?? [];
  const invitations = teamQuery.data?.invitations ?? [];

  const togglePermission = (permission: AdminPermission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const toggleEditPermission = (permission: AdminPermission) => {
    setEditingPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const inviteSupportAdmin = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!permissions.length) {
      setError('Choose at least one support permission.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await adminApi<InvitationResponse>('/v1/admin/invitations', session.access_token, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, permissions }),
      });
      setInviteEmail('');
      const deliveryNotice = result.delivery === 'sent'
        ? 'An invitation email was sent.'
        : result.delivery === 'failed'
          ? 'The invitation was recorded, but email delivery failed. Share the account-registration link manually.'
          : 'The invitation was recorded. Email delivery is not configured; share the account-registration link manually.';
      setNotice(`${deliveryNotice} Access activates after they verify this email and sign in. Reference ${result.invitationId.slice(0, 8)}…`);
      await teamQuery.refetch();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not create the support invitation.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (membership: AdminMembership) => {
    setEditingId(membership.id);
    setEditingPermissions(membership.permissions as AdminPermission[]);
    setError('');
    setNotice('');
  };

  const savePermissions = async () => {
    if (!editingId || !editingPermissions.length) {
      setError('Choose at least one permission before saving.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi(`/v1/admin/memberships/${editingId}`, session.access_token, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: editingPermissions }),
      });
      setEditingId(null);
      setNotice('Support permissions updated.');
      await teamQuery.refetch();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update permissions.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (membershipId: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await adminApi(`/v1/admin/memberships/${membershipId}`, session.access_token, { method: 'DELETE' });
      setNotice('Support access revoked.');
      await teamQuery.refetch();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke support access.');
    } finally {
      setSaving(false);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await adminApi(`/v1/admin/invitations/${invitationId}`, session.access_token, { method: 'DELETE' });
      setNotice('Pending invitation revoked.');
      await teamQuery.refetch();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Could not revoke the invitation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">OWNER CONTROL</p>
          <h1>Team access</h1>
          <p className="page-lede">Add support administrators and grant only the capabilities they need.</p>
        </div>
        <button className="button button-secondary" onClick={() => { setError(''); void teamQuery.refetch(); }} disabled={teamQuery.isFetching}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error || teamQuery.error ? <div className="alert alert-error" role="alert">{error || (teamQuery.error instanceof Error ? teamQuery.error.message : 'Could not load team access.')}</div> : null}
      {notice ? <div className="alert alert-success" role="status">{notice}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <div className="panel-icon"><UserPlus size={18} /></div>
          <div>
            <h2>Invite support by email</h2>
            <p>Add the email before they sign up. The invitation activates only after that email is verified and the person signs in.</p>
          </div>
        </div>
        <label className="field-label" htmlFor="support-email">Email address</label>
        <div className="form-row">
          <input
            autoComplete="email"
            id="support-email"
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="colleague@example.com"
            type="email"
            value={inviteEmail}
          />
          <button className="button button-primary" onClick={() => void inviteSupportAdmin()} disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Shield size={16} />}
            Create invitation
          </button>
        </div>
        <PermissionPicker permissions={permissions} onToggle={togglePermission} />
        <p className="form-help">Email delivery uses the server-side Resend configuration. Invitees must verify the invited email before access activates. Only you can grant, change, or revoke support access.</p>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div><h2>Email invitations</h2><p>Unaccepted invitations expire automatically after 30 days.</p></div>
          <span className="count-pill">{invitations.length} records</span>
        </div>
        {teamQuery.isLoading ? <div className="loading-state"><LoaderCircle className="spin" size={18} /> Loading invitations</div> : invitations.length ? (
          <div className="table-wrap"><table><thead><tr><th>Email</th><th>Permissions</th><th>Invited</th><th>State</th><th /></tr></thead><tbody>
            {invitations.map((invitation) => {
              const state = invitation.revoked_at ? 'Revoked' : invitation.accepted_at ? 'Accepted' : new Date(invitation.expires_at) <= new Date() ? 'Expired' : 'Pending';
              return <tr key={invitation.id}>
                <td>{invitation.email_normalized}</td>
                <td><div className="permission-tags">{invitation.permissions.map((permission) => <span className="tag" key={permission}>{permissionLabel(permission)}</span>)}</div></td>
                <td>{new Date(invitation.invited_at).toLocaleDateString()}</td>
                <td><span className={`status ${state === 'Pending' ? 'status-open' : 'status-closed'}`}>{state}</span></td>
                <td>{state === 'Pending' ? <button className="text-button" onClick={() => void revokeInvitation(invitation.id)} disabled={saving}>Revoke</button> : null}</td>
              </tr>;
            })}
          </tbody></table></div>
        ) : <div className="empty-state">No email invitations yet.</div>}
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <h2>Membership history</h2>
            <p>Revoked memberships remain listed for audit; grants cannot be reactivated.</p>
          </div>
          <span className="count-pill">{memberships.length} records</span>
        </div>

        {teamQuery.isLoading ? (
          <div className="loading-state"><LoaderCircle className="spin" size={18} /> Loading membership records</div>
        ) : memberships.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Account ID</th><th>Access</th><th>Granted</th><th>Status</th><th /></tr></thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td><code>{membership.user_id}</code><small>Membership {membership.id.slice(0, 8)}</small></td>
                    <td>
                      {membership.role === 'platform_owner' ? <span className="role-pill owner-pill">Platform owner</span> : (
                        <div className="permission-tags">
                          {membership.permissions.map((permission) => <span className="tag" key={permission}>{permissionLabel(permission)}</span>)}
                        </div>
                      )}
                    </td>
                    <td>{new Date(membership.granted_at).toLocaleDateString()}</td>
                    <td>{membership.revoked_at ? <span className="status status-closed">Revoked</span> : <span className="status status-open">Active</span>}</td>
                    <td className="table-actions">
                      {membership.role === 'support_admin' && !membership.revoked_at ? (
                        <>
                          <button className="text-button" onClick={() => beginEdit(membership)}>Edit</button>
                          <button className="icon-button danger-button" title="Revoke support access" onClick={() => void revoke(membership.id)} disabled={saving}>
                            <UserRoundX size={16} />
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No team memberships yet.</div>
        )}
      </section>

      {editingId ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setEditingId(null)}>
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-membership-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div className="panel-icon"><Shield size={18} /></div>
              <div>
                <h2 id="edit-membership-title">Update support permissions</h2>
                <p>Changes take effect immediately.</p>
              </div>
            </div>
            <PermissionPicker permissions={editingPermissions} onToggle={toggleEditPermission} />
            <div className="dialog-actions">
              <button className="button button-secondary" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="button button-primary" onClick={() => void savePermissions()} disabled={saving}>
                {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save permissions
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PermissionPicker({ permissions, onToggle }: { permissions: AdminPermission[]; onToggle(permission: AdminPermission): void }) {
  return (
    <div className="permission-grid">
      {permissionOptions.map((option) => (
        <label className="permission-option" key={option.id}>
          <input checked={permissions.includes(option.id)} onChange={() => onToggle(option.id)} type="checkbox" />
          <span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function permissionLabel(permission: string) {
  return permissionOptions.find((option) => option.id === permission)?.label ?? permission;
}
