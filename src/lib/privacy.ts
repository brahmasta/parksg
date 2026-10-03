import { siteOrigin } from './apiBase';

/** Version of public/privacy.html. Bump it (the date the policy changed) when
 *  the policy changes; profiles.privacy_version records which one a person
 *  accepted when they signed in. */
export const PRIVACY_VERSION = '2026-10-03';

/** On the site itself in the native apps too, where links open in the browser. */
export const privacyPolicyUrl = (): string => `${siteOrigin()}/privacy`;
export const deleteAccountUrl = (): string => `${siteOrigin()}/delete-account`;

/** Style for a sign-in button while the policy is unticked. */
export const consentDisabledStyle = { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' } as const;
