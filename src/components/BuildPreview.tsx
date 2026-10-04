import { useState } from "react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuildResult } from "@/lib/upgrade.functions";

export function BuildPreview({ build }: { build: BuildResult }) {
  const [full, setFull] = useState(false);

  function download() {
    const blob = new Blob([build.html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${build.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "project"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className={full ? "fixed inset-0 z-50 flex flex-col bg-background p-2" : "overflow-hidden rounded-xl border border-border"}>
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-2 py-1">
        <span className="truncate text-xs font-semibold">{build.title}</span>
        <div className="flex">
          <Button size="icon" variant="ghost" aria-label="Download" onClick={download}><Download className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label={full ? "Chhota karo" : "Poori screen"} onClick={() => setFull((f) => !f)}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <iframe
        title={build.title}
        srcDoc={build.html}
        sandbox="allow-scripts allow-forms allow-modals"
        className={full ? "w-full flex-1 bg-background" : "h-[420px] w-full bg-background"}
      />
    </div>
  );
}
