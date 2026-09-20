import { Platform } from "obsidian";

export interface PlaceholderRuntimePlatform {
  isMobile: boolean;
  isAndroid: boolean;
  isIos: boolean;
}

export const DESKTOP_INITIAL_SCAN_BATCH_SIZE = 20;
export const MOBILE_INITIAL_SCAN_BATCH_SIZE = 8;
export const DESKTOP_MANAGER_RENDER_CHUNK = 500;
export const MOBILE_MANAGER_RENDER_CHUNK = 100;
export const MOBILE_RESUME_FULL_REBUILD_AFTER_MS = 5 * 60 * 1000;
export const MOBILE_RESUME_DEDUPE_MS = 750;

export function detectRuntimePlatform(): PlaceholderRuntimePlatform {
  return {
    isMobile: Platform.isMobileApp,
    isAndroid: Platform.isAndroidApp,
    isIos: Platform.isIosApp,
  };
}

export function initialScanBatchSize(platform: PlaceholderRuntimePlatform): number {
  return platform.isMobile ? MOBILE_INITIAL_SCAN_BATCH_SIZE : DESKTOP_INITIAL_SCAN_BATCH_SIZE;
}

export function managerRenderChunkSize(platform: PlaceholderRuntimePlatform): number {
  return platform.isMobile ? MOBILE_MANAGER_RENDER_CHUNK : DESKTOP_MANAGER_RENDER_CHUNK;
}
