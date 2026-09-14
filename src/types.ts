export type ClipboardItemType = 'text' | 'file' | 'image' | 'code' | 'url';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'laptop';

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  title: string;
  content: string; // Plain text or Data URL for images/files
  previewUrl?: string; // Optional image preview URL
  fileName?: string;
  fileSize?: number; // Size in bytes
  fileMimeType?: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  createdAt: number;
  isPinned: boolean;
  category?: string;
  tags?: string[];
  charCount?: number;
  lineCount?: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  isCurrent: boolean;
  lastSeen: number;
  os?: string;
  browser?: string;
  color?: string;
}

export type FilterCategory = 'all' | 'pinned' | 'text' | 'file' | 'image' | 'code' | 'url';

export interface SyncEventPayload {
  action: 'create' | 'update' | 'delete' | 'clear' | 'device_registered' | 'ping';
  item?: ClipboardItem;
  itemId?: string;
  device?: Device;
  timestamp: number;
}

export interface HotspotSettings {
  proximityThreshold: number; // in pixels (e.g. 180px)
  cornerSize: number; // in pixels (e.g. 80px)
  autoOpenOnProximity: boolean;
  soundEffects: boolean;
  hapticFeedback: boolean;
}

export interface ServerSettings {
  publicUrl: string;
  detectedUrl: string;
  customPublicUrl: string | null;
  port: number;
  isNgrok: boolean;
  connectedClients: number;
  activeDevices: number;
  ngrokActive: boolean;
  ngrokUrl: string | null;
  hasAuthToken: boolean;
  authTokenMasked: string | null;
  domain: string | null;
  lastError: string | null;
}
