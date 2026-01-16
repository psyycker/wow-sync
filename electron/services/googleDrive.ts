import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import { shell } from 'electron';
import type { Profile } from '../../src/types/index.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];
const APP_FOLDER = 'appDataFolder';
const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

// Google OAuth2 credentials for Desktop app
// These are injected at build time from environment variables
// To set up your own credentials:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create a new project (or use existing)
// 3. Enable the Google Drive API
// 4. Create OAuth 2.0 credentials with type "Desktop app"
// 5. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export interface SyncStatus {
  connected: boolean;
  lastSyncTime: string | null;
  email: string | null;
}

export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  conflicts: string[];
}

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private credentialsPath: string;
  private drive: ReturnType<typeof google.drive> | null = null;

  constructor(userDataPath: string) {
    this.credentialsPath = path.join(userDataPath, 'google-credentials.json');
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    this.loadCredentials();
  }

  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'));
        this.oauth2Client.setCredentials(credentials);
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      }
    } catch (err) {
      console.error('Failed to load Google credentials:', err);
    }
  }

  private saveCredentials(tokens: object): void {
    fs.writeFileSync(this.credentialsPath, JSON.stringify(tokens, null, 2));
  }

  isConfigured(): boolean {
    return (
      Boolean(CLIENT_ID && CLIENT_SECRET) &&
      !CLIENT_ID.startsWith('YOUR_') &&
      !CLIENT_SECRET.startsWith('YOUR_')
    );
  }

  isConnected(): boolean {
    return Boolean(this.oauth2Client.credentials?.access_token);
  }

  async getStatus(): Promise<SyncStatus> {
    if (!this.isConnected()) {
      return { connected: false, lastSyncTime: null, email: null };
    }

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return {
        connected: true,
        lastSyncTime: null,
        email: userInfo.data.email || null,
      };
    } catch {
      return { connected: false, lastSyncTime: null, email: null };
    }
  }

  async authenticate(): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
      );
    }

    return new Promise((resolve, reject) => {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });

      // Create a temporary server to handle the OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`);

          if (url.pathname === '/oauth2callback') {
            const code = url.searchParams.get('code');

            if (code) {
              const { tokens } = await this.oauth2Client.getToken(code);
              this.oauth2Client.setCredentials(tokens);
              this.saveCredentials(tokens);
              this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #e8e8e8;">
                    <h1 style="color: #c9a227;">Success!</h1>
                    <p>You can close this window and return to WoW Settings Manager.</p>
                    <script>window.close();</script>
                  </body>
                </html>
              `);

              server.close();
              resolve(true);
            } else {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<html><body>Authorization failed. No code received.</body></html>');
              server.close();
              reject(new Error('No authorization code received'));
            }
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body>Authorization failed.</body></html>');
          server.close();
          reject(err);
        }
      });

      server.listen(REDIRECT_PORT, () => {
        console.log(`OAuth callback server listening on port ${REDIRECT_PORT}`);
        shell.openExternal(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out'));
      }, 5 * 60 * 1000);
    });
  }

  async disconnect(): Promise<void> {
    try {
      if (this.oauth2Client.credentials?.access_token) {
        await this.oauth2Client.revokeCredentials();
      }
    } catch {
      // Ignore revocation errors
    }

    this.oauth2Client.setCredentials({});
    this.drive = null;

    if (fs.existsSync(this.credentialsPath)) {
      fs.unlinkSync(this.credentialsPath);
    }
  }

  // Note: ensureAppFolder is kept for potential future use
  // App data folder is automatically available in Google Drive API

  private async findFileByName(name: string): Promise<string | null> {
    if (!this.drive) return null;

    try {
      const response = await this.drive.files.list({
        spaces: APP_FOLDER,
        q: `name='${name}' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
      });

      const files = response.data.files;
      if (files && files.length > 0) {
        return files[0].id || null;
      }
    } catch (err) {
      console.error('Error finding file:', err);
    }

    return null;
  }

  async uploadProfile(profile: Profile): Promise<void> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const fileName = `profile-${profile.id}.json`;
    const content = JSON.stringify(profile, null, 2);

    const existingFileId = await this.findFileByName(fileName);

    if (existingFileId) {
      // Update existing file
      await this.drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType: 'application/json',
          body: content,
        },
      });
      console.log(`Updated profile in Drive: ${profile.name}`);
    } else {
      // Create new file
      await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [APP_FOLDER],
        },
        media: {
          mimeType: 'application/json',
          body: content,
        },
      });
      console.log(`Uploaded new profile to Drive: ${profile.name}`);
    }
  }

  async downloadProfile(fileId: string): Promise<Profile> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const response = await this.drive.files.get({
      fileId,
      alt: 'media',
    });

    return response.data as Profile;
  }

  async listRemoteProfiles(): Promise<Array<{ id: string; name: string; modifiedTime: string; profile: Profile }>> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const response = await this.drive.files.list({
      spaces: APP_FOLDER,
      q: "name contains 'profile-' and name contains '.json' and trashed=false",
      fields: 'files(id, name, modifiedTime)',
    });

    const files = response.data.files || [];
    const profiles: Array<{ id: string; name: string; modifiedTime: string; profile: Profile }> = [];

    for (const file of files) {
      if (!file.id) continue;

      try {
        const profile = await this.downloadProfile(file.id);
        profiles.push({
          id: file.id,
          name: file.name || '',
          modifiedTime: file.modifiedTime || '',
          profile,
        });
      } catch (err) {
        console.error(`Failed to download profile ${file.name}:`, err);
      }
    }

    return profiles;
  }

  async deleteRemoteProfile(profileId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const fileName = `profile-${profileId}.json`;
    const fileId = await this.findFileByName(fileName);

    if (fileId) {
      await this.drive.files.delete({ fileId });
      console.log(`Deleted profile from Drive: ${profileId}`);
    }
  }

  async syncProfiles(
    localProfiles: Profile[],
    onProgress?: (message: string) => void
  ): Promise<SyncResult> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const result: SyncResult = {
      uploaded: [],
      downloaded: [],
      conflicts: [],
    };

    onProgress?.('Fetching remote profiles...');
    const remoteProfiles = await this.listRemoteProfiles();
    const remoteMap = new Map(remoteProfiles.map((r) => [r.profile.id, r]));

    // Upload local profiles that are newer or don't exist remotely
    for (const localProfile of localProfiles) {
      const remote = remoteMap.get(localProfile.id);

      if (!remote) {
        onProgress?.(`Uploading: ${localProfile.name}`);
        await this.uploadProfile(localProfile);
        result.uploaded.push(localProfile.name);
      } else {
        const localTime = new Date(localProfile.updatedAt).getTime();
        const remoteTime = new Date(remote.modifiedTime).getTime();

        if (localTime > remoteTime) {
          onProgress?.(`Uploading (newer): ${localProfile.name}`);
          await this.uploadProfile(localProfile);
          result.uploaded.push(localProfile.name);
        } else if (remoteTime > localTime) {
          result.downloaded.push(localProfile.name);
        }
      }
    }

    // Find profiles that only exist remotely
    const localIds = new Set(localProfiles.map((p) => p.id));
    for (const remote of remoteProfiles) {
      if (!localIds.has(remote.profile.id)) {
        result.downloaded.push(remote.profile.name);
      }
    }

    return result;
  }

  async pullProfiles(): Promise<Profile[]> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    const remoteProfiles = await this.listRemoteProfiles();
    return remoteProfiles.map((r) => r.profile);
  }

  async pushAllProfiles(profiles: Profile[]): Promise<void> {
    if (!this.drive) {
      throw new Error('Not connected to Google Drive');
    }

    for (const profile of profiles) {
      await this.uploadProfile(profile);
    }
  }
}
