"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { PanelRightClose, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SessionPanel {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
}

/** Panels remain mounted so changing the layout preserves form and journey state. */
export function SessionWorkspace({ children, panels }: { children: ReactNode; panels: SessionPanel[] }) {
  const id = useId();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = panels.find((panel) => panel.id === activePanel);

  function closePanel() {
    if (activePanel) buttons.current[activePanel]?.focus();
    setActivePanel(null);
  }

  return (
    <section aria-label="Espaço de jogo" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Abra um painel para consultar sua mesa.</p>
        <div role="group" aria-label="Painéis da sessão" className="flex max-w-full items-center gap-1 overflow-x-auto py-1">
          {panels.map((panel) => (
            <Button
              key={panel.id}
              ref={(element) => { buttons.current[panel.id] = element; }}
              id={`${id}-${panel.id}-button`}
              variant={activePanel === panel.id ? "default" : "outline"}
              className="h-11"
              aria-expanded={activePanel === panel.id}
              aria-controls={`${id}-${panel.id}`}
              onClick={() => setActivePanel((current) => current === panel.id ? null : panel.id)}
            >
              <panel.icon className="size-4" aria-hidden="true" /> {panel.label}
            </Button>
          ))}
        </div>
      </div>
      <div className={cn("grid min-w-0 items-start gap-4", active && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="min-w-0">{children}</div>
        <aside
          aria-label="Painel da sessão"
          className={cn("order-first max-h-[70dvh] min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-primary/25 bg-card p-3 lg:order-last lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]", !active && "hidden")}
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
            <h2 className="font-heading text-lg">{active?.label}</h2>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Recolher painel da sessão" onClick={closePanel}>
              <PanelRightClose className="size-5" />
            </Button>
          </div>
          {panels.map((panel) => (
            <div key={panel.id} id={`${id}-${panel.id}`} role="region" aria-labelledby={`${id}-${panel.id}-button`} hidden={activePanel !== panel.id}>
              {panel.content}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
