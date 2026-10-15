import { KanbanBoard } from "./components/board/KanbanBoard";
import { PreviewBoard } from "./components/board/PreviewBoard";
import { ReminderPopup } from "./components/board/ReminderPopup";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function App() {
  const runningInTauri = "__TAURI_INTERNALS__" in window;
  if (runningInTauri && getCurrentWindow().label === "reminder") return <ReminderPopup />;
  return runningInTauri ? <KanbanBoard /> : <PreviewBoard />;
}
