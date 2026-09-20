import type { PlaceholderRuntimePlatform } from "./runtime";

/**
 * Selecting a whole field on mobile creates selection handles and can make the
 * soft keyboard resize/scroll the modal twice. Mobile focuses at the end;
 * desktop keeps the convenient select-all behavior.
 */
export function focusModalTextControl(
  input: HTMLInputElement | HTMLTextAreaElement | undefined,
  platform: PlaceholderRuntimePlatform,
): void {
  if (!input) return;
  input.focus({ preventScroll: platform.isMobile });

  if (!platform.isMobile) {
    input.select();
    return;
  }

  const end = input.value.length;
  if (typeof input.setSelectionRange === "function") input.setSelectionRange(end, end);
}
