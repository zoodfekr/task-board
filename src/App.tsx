import { KanbanBoard } from "./components/board/KanbanBoard";
import { PreviewBoard } from "./components/board/PreviewBoard";

export default function App() {
  const runningInTauri = "__TAURI_INTERNALS__" in window;
  return runningInTauri ? <KanbanBoard /> : <PreviewBoard />;
}
