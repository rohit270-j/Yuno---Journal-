# AI Journal
A secure, multi-turn AI journaling application powered by Gemini and Firebase.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express + Node.js (Proxy for Gemini API)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth (Google Sign-In)

## Prerequisites
- Node.js 18+
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- A Firebase project with Authentication (Google Sign-In) and Firestore Database enabled.

## Environment & Prerequisites Setup

1. **Enable Google Cloud APIs**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable firestore.googleapis.com
   ```

2. **Database Security Configuration**
   Deploy the following Firestore rules (`firestore.rules`) to ensure data isolation. These rules restrict users to only access their own documents.

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/interactions/{interactionId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   Deploy the rules using the Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Secret Management Setup

We use Google Cloud Secret Manager to securely store and inject the `GEMINI_API_KEY`. 

1. **Create and Populate the Secret**
   ```bash
   # Create the secret
   gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
   
   # Add your key (replace YOUR_API_KEY with your actual Gemini API Key)
   echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
   ```

2. **Grant Secret Accessor Permissions**
   Grant the default Cloud Run service account access to read the secret:
   ```bash
   gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
     --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

## Local Development
1. Clone the repository and run `npm install`.
2. Configure `.env` based on `.env.example` by copying it:
   ```bash
   cp .env.example .env
   ```
3. Populate your `.env` with your Firebase client details and `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   VITE_FIREBASE_API_KEY="your-firebase-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
   VITE_FIREBASE_APP_ID="your-app-id"
   VITE_FIREBASE_DATABASE_ID="your-firestore-database-id"
   ```
   > **Security Notice**: `.env` and `firebase-applet-config.json` are listed in `.gitignore` and are strictly excluded from source control.
4. Run `npm run dev` to start the frontend and backend locally on port 3000.

## Cloud Run Deployment Flow

Follow these steps to build and deploy the app to Google Cloud Run natively.

1. **Build and Deploy**
   ```bash
   # Make sure you are in the project root
   gcloud run deploy ai-journal-app \
     --source . \
     --port 3000 \
     --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest \
     --allow-unauthenticated \
     --region us-central1
   ```

2. **Required Campaign Labeling**
   Apply the mandatory resource label to register the service for automated challenge verification:
   ```bash
   gcloud run services update ai-journal-app \
     --update-labels=dev-tutorial=cloud-run-ai-challenge \
     --region=us-central1
   ```
