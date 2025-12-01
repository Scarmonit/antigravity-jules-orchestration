# Google Cloud Configuration: Final Steps

You have successfully created the OAuth Client. To finalize the Google Cloud setup for external user access (required if you plan to add "Login with Google" to the dashboard), complete these three actions in the [Google Cloud Console](https://console.cloud.google.com/auth/overview).

## ✅ Action 1: Configure Essential Scopes
1. Navigate to **[API & Services > OAuth consent screen > Edit](https://console.cloud.google.com/auth/branding)**.
2. Go to the **Scopes** step.
3. Click **Add or Remove Scopes**.
4. Select/Add the following basic scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
5. *(Optional)* If the agent needs to act on behalf of a user for Google Drive/Docs, add those specific API scopes here.
6. Click **Update** and then **Save and Continue**.

## ✅ Action 2: Authorized Domains
1. Navigate to **[API & Services > OAuth consent screen > Branding](https://console.cloud.google.com/auth/branding)**.
2. Scroll to **Authorized domains**.
3. Click **Add Domain**.
4. Add the following domains:
   - `onrender.com` (For the API)
   - `pages.dev` (For the Dashboard)
   - `scarmonit.com` (Your custom domain)
5. Under **App Domain**, add your links:
   - **Home Page**: `https://main.jules-dashboard-9u3.pages.dev`
   - **Privacy Policy**: `https://main.jules-dashboard-9u3.pages.dev/privacy` (Placeholder)
   - **Terms**: `https://main.jules-dashboard-9u3.pages.dev/terms` (Placeholder)
6. Click **Save**.

## ✅ Action 3: Test Users (External Mode)
Since your app is in **Testing** mode, only whitelisted users can log in.

1. Navigate to **[API & Services > OAuth consent screen > Audience](https://console.cloud.google.com/auth/audience)**.
2. Under **Test users**, click **Add Users**.
3. Add your email: `scarmonit@gmail.com`.
4. Click **Save**.

---

## ⚠️ CRITICAL REMINDER: Backend Service Account
While the OAuth Client setup (above) allows *users* to log in, the **Jules Orchestrator API** (Backend) running on Render still needs its **Service Account Key** to talk to Google APIs autonomously.

1. Ensure you have the `service-account.json` key file.
2. Paste its content into the `GOOGLE_APPLICATION_CREDENTIALS_JSON` environment variable in Render.