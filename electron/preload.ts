import { contextBridge, ipcRenderer } from 'electron';
import type { IPCChannels } from '../src/types/index.js';

const electronAPI = {
  invoke<K extends keyof IPCChannels>(
    channel: K,
    ...args: Parameters<IPCChannels[K]>
  ): ReturnType<IPCChannels[K]> {
    return ipcRenderer.invoke(channel, ...args) as ReturnType<IPCChannels[K]>;
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
