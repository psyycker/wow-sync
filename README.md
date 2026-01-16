# WoW Settings Manager

A desktop application for synchronizing World of Warcraft addon settings across multiple devices using Google Drive.

## Features

- **Cross-device sync** - Keep your addon settings in sync across all your computers via Google Drive
- **Profile management** - Create, save, and load addon setting profiles
- **Multi-version support** - Works with Retail, Classic, and Classic Era
- **Supported addons**:
  - ConsolePort
  - ElvUI
  - WeakAuras
  - Details! Damage Meter
  - Deadly Boss Mods (DBM)
  - BigWigs
  - Bartender4
  - Dominos

## Download

Download the latest release for your platform from the [Releases](https://github.com/psyycker/wow-sync/releases) page:

- **Windows**: `.exe` installer
- **macOS**: `.dmg` disk image
- **Linux/Steam Deck**: `.AppImage`

### Steam Deck

1. Download the `.AppImage` file
2. Make it executable: `chmod +x WoW-Settings-Manager-*.AppImage`
3. Run it directly or add as a non-Steam game

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for your platform
npm run electron:build
```

### Environment Variables

For Google Drive sync to work, you need Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project and enable the Google Drive API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Copy `.env.example` to `.env` and add your credentials:

```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### Build Commands

```bash
npm run electron:dev      # Development mode with hot reload
npm run electron:build    # Build for current platform
npm run electron:build:mac    # Build for macOS
npm run electron:build:linux  # Build for Linux (AppImage)
npm run electron:build:win    # Build for Windows
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Zustand
- **Desktop**: Electron 34
- **Build**: Vite, electron-builder

## License

MIT
