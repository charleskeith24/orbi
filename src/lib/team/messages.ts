/**
 * Team workspaces — every user-facing string (ARCHITECTURE §11).
 *
 * It lives in `src/lib/team` rather than in the feature folder because the data store needs the three
 * refusal toasts, and lib code must not import from `src/components`. The UI reads the same namespace
 * with `useT(teamMessages)`.
 */
import { defineMessages } from "@/lib/i18n/core"

export const teamMessages = defineMessages({
  en: {
    // The store's refusals (a write row-level security would reject anyway).
    refused_viewer: "Viewers can't edit",
    refused_owner_only: "Only the workspace owner can change this",
    refused_no_money: "You don't have Money access in this workspace",

    // Settings → Team
    tab_title: "Team",
    tab_description: "People in your workspace",
    tab_info:
      "Invite a VA, editor, manager or client into your workspace. Editors write the content work; viewers read only. Money stays hidden until you turn it on for someone.",
    local_title: "Team needs the online version",
    local_body: "This copy of Orbi saves to this browser only, so there are no accounts to invite.",
    members_title: "Members",
    members_empty: "Nobody else is in your workspace yet.",
    invites_title: "Pending",
    invites_empty: "No invites waiting.",
    refresh: "Refresh",
    joined: "Joined {date}",
    invited: "Invited {date}",

    // Roles
    role_owner: "Owner",
    role_editor: "Editor",
    role_viewer: "Viewer",
    role_owner_hint: "Everything, including Money and Settings.",
    role_editor_hint: "Writes ideas, content, scripts and analytics. Brand HQ, audience and pillars stay read-only.",
    role_viewer_hint: "Reads only. No create, edit or delete.",
    role_label: "Role",

    // Money access
    money_access: "Money access",
    money_access_info: "Brand deals, income and rate cards are hidden from members until you turn this on.",
    money_on: "Money: on",
    money_off: "Money: off",

    // Invite
    invite: "Invite",
    invite_title: "Invite someone",
    invite_email: "Email",
    invite_email_placeholder: "name@email.com",
    invite_help: "They need an Orbi account already. If they have one, they'll see your invite in the app.",
    invite_no_account: "No account yet? Ask them to request access first.",
    invite_request_access: "Share the sign-up link",
    invite_send: "Send invite",
    invite_sent: "Invite sent to {email}",
    invite_cancel: "Cancel invite",
    invite_cancelled: "Invite cancelled",
    seats_left_one: "{count} seat left",
    seats_left_other: "{count} seats left",
    seats_full: "All 5 seats are taken",

    // Member actions
    member_saved: "Member updated",
    remove: "Remove",
    remove_title: "Remove this member?",
    remove_body: "They lose access straight away. Nothing they made is deleted.",
    removed: "Member removed",
    leave: "Leave workspace",
    leave_title: "Leave {name}?",
    leave_body: "You lose access straight away. You can be invited again.",
    left: "You left {name}",

    // The switcher and the strip
    switcher_label: "Workspace",
    my_workspace: "My workspace",
    in_workspace: "You're in {name}",
    in_workspace_info:
      "You're working in someone else's workspace. What you can do here is set by your role. Your language and Simple mode stay yours.",
    back_to_mine: "Back to my workspace",
    back_home: "Go to Home",
    switched: "Now in {name}",
    no_longer_member: "You're no longer in that workspace — back to your own.",

    // A member's own view of Settings → Team
    member_view_title: "Your role here",
    member_view_body: "{name} invited you as {role}.",
    owner_only_notice: "Only the workspace owner can change this.",
    owner_only_body: "Import and export, Integrations, AI keys and Reminders stay with the owner of this workspace.",
    read_only_notice: "Read-only here — your role is {role}.",

    // The invite banner
    banner_invited: "{name} invited you as {role}",
    accept: "Accept",
    decline: "Decline",
    accepted: "You joined {name}",
    declined: "Invite declined",

    // Concurrent edits
    concurrent_label: "Working at the same time",
    concurrent_info:
      "Two people editing the same post at the same time can overwrite each other: Orbi keeps the last save. Refresh before a big edit, and reload after a while away.",
    sample_note: "Sample team — development fixture, not real accounts.",

    // Errors (the team functions' codes)
    err_not_signed_in: "Sign in again to do that.",
    err_invalid_email: "That doesn't look like an email address.",
    err_invalid_role: "Pick Editor or Viewer.",
    err_self_invite: "That's your own email.",
    err_already_member: "They're already in your workspace.",
    err_workspace_full: "Your workspace is full (5 members during the beta).",
    err_too_many_workspaces: "You're in too many workspaces already.",
    err_not_member: "They're not in this workspace any more.",
    err_not_found: "That invite is gone.",
    err_network: "No connection — try again.",
    err_unknown: "Something went wrong. Try again.",
  },
  tl: {
    refused_viewer: "Hindi pwedeng mag-edit ang Viewer",
    refused_owner_only: "Ang owner lang ng workspace ang pwedeng mag-change nito",
    refused_no_money: "Wala kang Money access sa workspace na ito",

    tab_title: "Team",
    tab_description: "Mga tao sa workspace mo",
    tab_info:
      "Pwede kang mag-invite ng VA, editor, manager o client sa workspace mo. Nagsusulat ng content work ang Editor; read-only ang Viewer. Nakatago ang Money hangga't hindi mo ito binubuksan para sa kanila.",
    local_title: "Kailangan ng online version ang Team",
    local_body: "Sa browser lang naka-save ang Orbi na ito, kaya wala pang accounts na pwedeng i-invite.",
    members_title: "Members",
    members_empty: "Wala pang iba sa workspace mo.",
    invites_title: "Pending",
    invites_empty: "Walang naghihintay na invite.",
    refresh: "I-refresh",
    joined: "Sumali {date}",
    invited: "Na-invite {date}",

    role_owner: "Owner",
    role_editor: "Editor",
    role_viewer: "Viewer",
    role_owner_hint: "Lahat, kasama ang Money at Settings.",
    role_editor_hint: "Nagsusulat ng ideas, content, scripts at analytics. Read-only ang Brand HQ, audience at pillars.",
    role_viewer_hint: "Puro tingin lang. Walang create, edit o delete.",
    role_label: "Role",

    money_access: "Money access",
    money_access_info: "Nakatago sa members ang brand deals, income at rate cards hangga't hindi mo ito binubuksan.",
    money_on: "Money: on",
    money_off: "Money: off",

    invite: "I-invite",
    invite_title: "Mag-invite",
    invite_email: "Email",
    invite_email_placeholder: "pangalan@email.com",
    invite_help: "Kailangan may Orbi account na siya. Kung meron, makikita niya ang invite mo sa app.",
    invite_no_account: "Wala pang account? Sabihin mong mag-request access muna.",
    invite_request_access: "I-share ang sign-up link",
    invite_send: "Send invite",
    invite_sent: "Na-send ang invite kay {email}",
    invite_cancel: "I-cancel ang invite",
    invite_cancelled: "Na-cancel ang invite",
    seats_left_one: "{count} seat pa",
    seats_left_other: "{count} seats pa",
    seats_full: "Puno na ang 5 seats",

    member_saved: "Na-update ang member",
    remove: "I-remove",
    remove_title: "I-remove ang member na ito?",
    remove_body: "Mawawala agad ang access niya. Walang madedelete sa ginawa niya.",
    removed: "Na-remove ang member",
    leave: "Umalis sa workspace",
    leave_title: "Aalis sa {name}?",
    leave_body: "Mawawala agad ang access mo. Pwede ka namang i-invite ulit.",
    left: "Umalis ka sa {name}",

    switcher_label: "Workspace",
    my_workspace: "Workspace ko",
    in_workspace: "Nasa {name} ka",
    in_workspace_info:
      "Nasa workspace ka ng iba. Ang role mo ang magdedesisyon kung ano ang pwede mo ritong gawin. Sa iyo pa rin ang language at Simple mode mo.",
    back_to_mine: "Balik sa workspace ko",
    back_home: "Pumunta sa Home",
    switched: "Nasa {name} ka na",
    no_longer_member: "Wala ka na sa workspace na iyon — balik sa sarili mo.",

    member_view_title: "Ang role mo rito",
    member_view_body: "Ininvite ka ni {name} bilang {role}.",
    owner_only_notice: "Ang owner lang ng workspace ang pwedeng mag-change nito.",
    owner_only_body: "Sa owner ng workspace na ito nananatili ang import at export, Integrations, AI keys at Reminders.",
    read_only_notice: "Read-only rito — {role} ang role mo.",

    banner_invited: "Ininvite ka ni {name} bilang {role}",
    accept: "Accept",
    decline: "Decline",
    accepted: "Sumali ka sa {name}",
    declined: "Na-decline ang invite",

    concurrent_label: "Kapag sabay kayong nag-eedit",
    concurrent_info:
      "Kapag sabay kayong nag-edit ng parehong post, pwedeng ma-overwrite ang isa: ang huling save ang mananatili. I-refresh bago ang malaking edit, at i-reload pagkatapos ng matagal na wala.",
    sample_note: "Sample team — development fixture, hindi totoong accounts.",

    err_not_signed_in: "Mag-sign in ulit para magawa ito.",
    err_invalid_email: "Mukhang hindi email address ito.",
    err_invalid_role: "Pumili ng Editor o Viewer.",
    err_self_invite: "Email mo mismo iyan.",
    err_already_member: "Nasa workspace mo na siya.",
    err_workspace_full: "Puno na ang workspace mo (5 members sa beta).",
    err_too_many_workspaces: "Sobra na ang dami ng workspaces na kasali ka.",
    err_not_member: "Wala na siya sa workspace na ito.",
    err_not_found: "Wala na ang invite na iyon.",
    err_network: "Walang connection — subukan ulit.",
    err_unknown: "May mali — subukan ulit.",
  },
})
