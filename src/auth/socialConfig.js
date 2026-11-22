// ------------------------------------------------------------------
// Google / Facebook sign-in credentials (OAuth).
//
// Put the two values below and the buttons switch ON by themselves,
// no code change needed:
//
//   GOOGLE_CLIENT_ID   Google Cloud Console -> APIs & Services ->
//                      Credentials -> Create OAuth client ID -> Web application
//                      (add the redirect URL the app shows you to
//                      "Authorised redirect URIs")
//   FACEBOOK_APP_ID    developers.facebook.com -> your app -> Settings
//                      -> Basic -> App ID
//
// While they are empty the buttons stay visible and explain that
// social sign-in is not enabled on this build yet.
// ------------------------------------------------------------------

export const GOOGLE_CLIENT_ID = '';
export const FACEBOOK_APP_ID = '';

export const isGoogleReady = () => GOOGLE_CLIENT_ID.trim().length > 0;
export const isFacebookReady = () => FACEBOOK_APP_ID.trim().length > 0;

// expo-auth-session needs a value at request-build time; a harmless
// placeholder keeps the hook healthy while the real ID is missing.
const PLACEHOLDER = 'not-configured.apps.slati';

export const googleClientId = () => GOOGLE_CLIENT_ID.trim() || PLACEHOLDER;
export const facebookAppId = () => FACEBOOK_APP_ID.trim() || PLACEHOLDER;
