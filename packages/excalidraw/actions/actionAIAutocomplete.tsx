import { KEYS, isDarwin } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { brainIcon } from "../components/icons";

import { register } from "./register";

const TEXT_EDITOR_SELECTOR = ".excalidraw-textEditorContainer > textarea";

export const actionAIAutocomplete = register({
  name: "aiAutocomplete",
  label: "labels.aiAutocomplete",
  icon: brainIcon,
  keywords: ["ai", "autocomplete", "complete"],
  trackEvent: { category: "toolbar", action: "aiAutocomplete" },
  predicate: (_, appState, appProps) => {
    return appProps.aiEnabled !== false && !!appProps.onAIAutocompleteRequest;
  },
  perform(elements, appState, _, app) {
    if (appState.editingTextElement) {
      const textarea =
        document.querySelector<HTMLTextAreaElement>(TEXT_EDITOR_SELECTOR);
      if (textarea && textarea.value.trim()) {
        const event = new KeyboardEvent("keydown", {
          key: KEYS.PERIOD,
          code: "Period",
          ctrlKey: !isDarwin,
          metaKey: isDarwin,
          bubbles: true,
        });
        textarea.dispatchEvent(event);
      }
      return false;
    }
    return {
      appState: {
        ...appState,
        openSidebar: { name: "default", tab: "ai" },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.key === KEYS.PERIOD && !event.shiftKey,
});
