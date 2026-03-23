import {
  DefaultSidebar,
  Sidebar,
  THEME,
  useExcalidrawAPI,
  mutateElement,
} from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
  brainIconThin,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useState } from "react";

import "./AppSidebar.scss";

export const AppSidebar = () => {
  const { theme, openSidebar } = useUIAppState();
  const api = useExcalidrawAPI();

  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiEdit = async () => {
    if (!api || !aiPrompt.trim()) return;
    setIsAiLoading(true);

    // We send just the selected elements or the whole scene if none selected
    let targetElements = api.getSceneElements().filter((el: any) => {
      // Very naive logic to get active selection
      return Object.keys(api.getAppState().selectedElementIds).includes(el.id);
    });
    if (targetElements.length === 0) {
      targetElements = api.getSceneElements();
    }

    // Fallback exactly to user instructions
    const promptStr = `The user wants to edit the canvas: "${aiPrompt}". Return a valid JSON array of element representations with the requested property changes or new element additions (e.g. strokeColor, backgroundColor, width, type: "rectangle"). No markdown block, just pure JSON array of objects with proper fields. Here are the current relevant elements:\n\n${JSON.stringify(targetElements)}`;

    try {
      const backend = import.meta.env.VITE_APP_AI_BACKEND || "http://localhost:3016";
      const res = await fetch(`${backend}/v1/ai/autocomplete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptStr,
          systemPrompt: "You are an AI that ONLY outputs a valid JSON array representing Excalidraw elements. Never output markdown fences or conversational text."
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // naive parsing for demonstration
        if (data.type === "text" && data.value) {
          try {
            const cleanJson = data.value.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
            const patched = JSON.parse(cleanJson);
            if (Array.isArray(patched)) {
              const currentElements = api.getSceneElements();
              const currentIds = new Set(currentElements.map((e: any) => e.id));
              const newElements = currentElements.map((el) => {
                const patch = patched.find((p) => p.id === el.id);
                if (patch) {
                  return { ...el, ...patch };
                }
                return el;
              });

              const addedElements = patched.filter((p) => !p.id || !currentIds.has(p.id));
              addedElements.forEach(p => {
                if (!p.id) p.id = Math.random().toString(36).substring(2, 9);
                // Ensure required minimal fields are populated
                if (!p.version) p.version = 1;
                if (!p.versionNonce) p.versionNonce = Math.floor(Math.random() * 10000000);
                if (typeof p.x !== "number") p.x = 100;
                if (typeof p.y !== "number") p.y = 100;
                newElements.push(p);
              });

              api.updateScene({ elements: newElements });
            }
          } catch (err) {
            console.error("AI returned malformed JSON or patch", err);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
      setAiPrompt("");
    }
  };

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="aiedit"
          style={{ opacity: openSidebar?.tab === "aiedit" ? 1 : 0.4 }}
        >
          {brainIconThin}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>

      <Sidebar.Tab tab="aiedit" className="px-3" style={{ padding: "16px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--color-primary)" }}>AI Edit</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "12px", opacity: 0.8 }}>Select elements and ask the AI to modify them (e.g. "make it green").</p>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Describe your edit..."
          style={{
            width: "100%",
            height: "100px",
            background: "var(--island-bg-color)",
            color: "var(--text-primary-color)",
            border: "1px solid var(--color-primary)",
            borderRadius: "8px",
            padding: "8px",
            resize: "none",
            marginBottom: "12px"
          }}
        />
        <button
          onClick={handleAiEdit}
          disabled={isAiLoading || !aiPrompt.trim()}
          className="excalidraw-button"
          style={{ width: "100%", padding: "10px", fontWeight: "bold" }}
        >
          {isAiLoading ? "Pondering..." : "Apply Edit"}
        </button>
      </Sidebar.Tab>

      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_comments_${theme === THEME.DARK ? "dark" : "light"
                }.jpg)`,
              opacity: 0.7,
            }}
          />
          <div className="app-sidebar-promo-text">
            Make comments with Excalidraw+
          </div>
          <LinkButton
            href={`${import.meta.env.VITE_APP_PLUS_LP
              }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_presentations_${theme === THEME.DARK ? "dark" : "light"
                }.svg)`,
              backgroundSize: "60%",
              opacity: 0.4,
            }}
          />
          <div className="app-sidebar-promo-text">
            Create presentations with Excalidraw+
          </div>
          <LinkButton
            href={`${import.meta.env.VITE_APP_PLUS_LP
              }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
