# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WoW Settings Manager - An Electron desktop app for synchronizing World of Warcraft addon settings across devices via Google Drive. Supports Retail, Classic, and Classic Era versions.

## Build & Development Commands

```bash
npm run dev              # Vite dev server only
npm run electron:dev     # Full dev environment (Vite + Electron concurrent)
npm run build            # TypeScript compile + Vite production build
npm run lint             # ESLint check
npm run electron:build   # Production build with Electron Builder (cross-platform)
```

## Architecture

**Stack**: React 19 + TypeScript + Electron 34 + Zustand + Vite

**Structure**:
- `/src` - React frontend (components, store, types)
- `/electron` - Main process (IPC handlers, services)
- `/electron/services` - Business logic (wowDetector, profileManager, settingsManager, googleDrive)

**Key Patterns**:
1. **Type-safe IPC**: All electron communication through `IPCChannels` interface in `/src/types/index.ts`
2. **Zustand store**: Centralized state in `/src/store/useAppStore.ts` with async IPC actions
3. **Preload bridge**: Secure context isolation via `/electron/preload.ts`

**IPC Channel Prefixes**: `wow:*`, `profiles:*`, `settings:*`, `gdrive:*`, `dialog:*`, `addons:*`

## Critical Rules

1. **NEVER use `any` type** - always use explicit types
2. **Console.log prefix**: Add `DEBUG` to log strings for filtering (e.g., `console.log('DEBUG:', data)`)
3. **IPC changes**: Update both `IPCChannels` interface in types AND handler in `/electron/main.ts`
4. **Async state**: Always manage `isSyncing`/`isLoading` states in store actions

## Key Files

- `/src/types/index.ts` - IPCChannels interface (source of truth for IPC)
- `/src/store/useAppStore.ts` - All state mutations
- `/electron/main.ts` - IPC handler registrations
- `/electron/services/profileManager.ts` - ADDON_FILES mapping for supported addons
- `/electron/services/googleDrive.ts` - OAuth2 setup (uses env vars GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)

## Supported Addons

ConsolePort, ElvUI, WeakAuras, Details, DBM, BigWigs, Bartender4, Dominos

## WoW Version Folders

- Retail: `_retail_`
- Classic: `_classic_`
- Classic Era: `_classic_era_`

## TypeScript Configuration

- Strict mode enabled
- ES2022 target, ESNext modules
- No CommonJS - full ESM
- noUnusedLocals and noUnusedParameters enabled
