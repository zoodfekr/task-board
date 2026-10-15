import { invoke } from "@tauri-apps/api/core";

export function getAlwaysOnTop(): Promise<boolean> {
  return invoke("get_always_on_top");
}

export function applyAlwaysOnTop(enabled: boolean): Promise<boolean> {
  return invoke("set_always_on_top", { enabled });
}
