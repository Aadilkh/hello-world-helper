import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BookOpen,
  Brain,
  Check,
  Code2,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Film,
  FolderOpen,
  Gauge,
  History,
  Image,
  Layers3,
  Library,
  Menu,
  Mic2,
  MoreHorizontal,
  Play,
  Plus,
  Rocket,
  Search,
  Settings2,
  Sparkles,
  TestTube2,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ResearchChat } from "@/components/ResearchChat";
import { ConnectedApps } from "@/components/ConnectedApps";
import { listProjects } from "@/lib/video.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vision Pilot — AI creative workspace" },
      {
        name: "description",
        content: "Apni soch se video, app aur content banayein — Urdu mein.",
      },
    ],
  }),
  component: VisionPilot,
});

type View = "studio" | "projects" | "memories" | "development" | "apps";

function VisionPilot() {
  const [view, setView] = useState<View>("studio");
  const [mobileNav, setMobileNav] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const queryClient = useQueryClient();
  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const projects = projectsQ.data?.projects ?? [];

  function openStudio() {
    setView("studio");
    setMobileNav(false);
  }

  return (
    <div className="vp-app">
      <header className="vp-topbar">
        <div className="vp-brand" onClick={openStudio} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openStudio()}>
          <span className="vp-brand-mark"><Clapperboard size={19} strokeWidth={2.5} /></span>
          <span>Vision <b>Pilot</b></span>
        </div>
        <div className="vp-topbar-center">
          <span className="vp-live-dot" /> <span>Workspace online</span>
        </div>
        <div className="vp-top-actions">
          <button className="vp-icon-button" aria-label="Help" onClick={() => setShowHelp(true)}><CircleHelp size={18} /></button>
          <button className="vp-avatar" aria-label="Adil profile">A</button>
          <button className="vp-menu-button" aria-label="Menu" onClick={() => setMobileNav((open) => !open)}><Menu size={20} /></button>
        </div>
      </header>

      <div className="vp-layout">
        <aside className={`vp-sidebar ${mobileNav ? "is-open" : ""}`}>
          <div className="vp-sidebar-section">
            <p className="vp-eyebrow">Workspace</p>
            <NavItem icon={Sparkles} label="Studio" active={view === "studio"} onClick={openStudio} />
            <NavItem icon={FolderOpen} label="My projects" active={view === "projects"} onClick={() => { setView("projects"); setMobileNav(false); }} count={projects.length || undefined} />
            <NavItem icon={BookOpen} label="Memories" active={view === "memories"} onClick={() => { setView("memories"); setMobileNav(false); }} count={projects.length || undefined} />
            <NavItem icon={Code2} label="Development" active={view === "development"} onClick={() => { setView("development"); setMobileNav(false); }} />
            <NavItem icon={Library} label="Connected apps" active={view === "apps"} onClick={() => { setView("apps"); setMobileNav(false); }} />
          </div>
          <div className="vp-sidebar-section vp-recent-list">
            <div className="vp-sidebar-title"><p className="vp-eyebrow">Recent work</p><History size={14} /></div>
            {projects.slice(0, 4).map((project) => (
              <button key={project.id} className="vp-recent-item" onClick={() => setView("projects")}>
                <span className="vp-recent-thumb"><Film size={15} /></span>
                <span className="vp-recent-copy"><b>{project.title || project.idea}</b><small>{project.ready ?? 0}/{project.total ?? 0} scenes ready</small></span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!projects.length && <p className="vp-empty-side">Your saved work will appear here.</p>}
          </div>
          <div className="vp-sidebar-bottom">
            <NavItem icon={Settings2} label="Settings" onClick={() => toast.message("Settings are coming soon")} />
            <div className="vp-credit-card">
              <div className="vp-credit-head"><span><Gauge size={14} /> Creative credits</span><b>72%</b></div>
              <div className="vp-credit-track"><span /></div>
              <small>720 / 1,000 credits remaining</small>
            </div>
          </div>
        </aside>

        <main className="vp-main">
          {view === "studio" && <Studio projects={projects} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["projects"] })} />}
          {view === "projects" && <Projects projects={projects} onBack={openStudio} />}
          {view === "memories" && <Memories projects={projects} onBack={openStudio} />}
          {view === "development" && <Development onBack={openStudio} />}
          {view === "apps" && <Apps onBack={openStudio} />}
        </main>
      </div>

      {showHelp && <div className="vp-modal-backdrop" onClick={() => setShowHelp(false)}><div className="vp-help-modal" onClick={(event) => event.stopPropagation()}><button className="vp-modal-close" onClick={() => setShowHelp(false)}><X size={18} /></button><span className="vp-help-icon"><Brain size={24} /></span><h2>Vision Pilot kaise kaam karta hai?</h2><p>Apna idea Urdu ya English mein likhein. Research Brain aapki audience, platform aur style samajh kar plan banata hai. Phir scenes se video tayyar hoti hai.</p><button className="vp-primary-button" onClick={() => setShowHelp(false)}>Samajh gaya</button></div></div>}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, count, onClick }: { icon: typeof Sparkles; label: string; active?: boolean; count?: number; onClick: () => void }) {
  return <button className={`vp-nav-item ${active ? "is-active" : ""}`} onClick={onClick}><Icon size={17} /><span>{label}</span>{count ? <em>{count}</em> : null}</button>;
}

function Studio({ projects, onRefresh }: { projects: Array<{ id: string; title: string | null; idea: string; ready?: number; total?: number }>; onRefresh: () => void }) {
  const [mode, setMode] = useState<"brain" | "script">("brain");
  return <div className="vp-content-wrap">
    <div className="vp-page-heading"><div><p className="vp-kicker"><span className="vp-kicker-dot" /> AI creative command center</p><h1>Assalam-o-alaikum, Adil<span className="vp-heading-dot">.</span></h1><p className="vp-subtitle">Aaj kya banate hain? Your idea is the only brief you need.</p></div><div className="vp-heading-actions"><span className="vp-date"><Clock3 size={15} /> October 07, 2026</span><button className="vp-square-action" aria-label="More options"><MoreHorizontal size={20} /></button></div></div>
    <div className="vp-stats-row"><Stat icon={Activity} value="24" label="Projects created" tone="mint" /><Stat icon={Layers3} value="86" label="Scenes generated" tone="amber" /><Stat icon={Rocket} value="12.4h" label="Time saved" tone="blue" /></div>
    <section className="vp-command-card">
      <div className="vp-command-glow" />
      <div className="vp-mode-tabs"><button className={mode === "brain" ? "is-active" : ""} onClick={() => setMode("brain")}><Brain size={17} /> Research Brain</button><button className={mode === "script" ? "is-active" : ""} onClick={() => setMode("script")}><WandSparkles size={17} /> Quick script</button><span className="vp-mode-note"><span className="vp-live-dot" /> Ready to create</span></div>
      {mode === "brain" ? <ResearchChat onPlan={() => onRefresh()} /> : <QuickScript onCreated={onRefresh} />}
    </section>
    <section className="vp-section-head"><div><p className="vp-kicker">Your creative library</p><h2>Pick up where you left off</h2></div><button className="vp-text-button" onClick={onRefresh}>View all <ArrowUpRight size={15} /></button></section>
    <div className="vp-project-grid">{projects.length ? projects.slice(0, 3).map((project, index) => <ProjectCard key={project.id} project={project} index={index} />) : <EmptyProjectCard />}</div>
    <div className="vp-tip"><span className="vp-tip-icon"><Sparkles size={17} /></span><p><b>Pro tip:</b> Aap image, voice note ya purani video reference ke liye attach kar sakte hain.</p><button onClick={() => toast.message("Reference tools are available in the composer")}>Try it <ChevronRight size={15} /></button></div>
  </div>;
}

function Stat({ icon: Icon, value, label, tone }: { icon: typeof Activity; value: string; label: string; tone: string }) { return <div className="vp-stat"><span className={`vp-stat-icon ${tone}`}><Icon size={17} /></span><div><b>{value}</b><span>{label}</span></div></div>; }

function QuickScript({ onCreated }: { onCreated: () => void }) { const [text, setText] = useState(""); return <div className="vp-quick-script"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Misal: Karachi ki barish par ek cinematic reel..." dir="auto" /><div className="vp-quick-footer"><span><Image size={17} /> Add reference</span><span><Mic2 size={17} /> Voice note</span><button className="vp-send-button" onClick={() => { if (!text.trim()) { toast.error("Pehle apna idea likhein"); return; } toast.success("Script workspace tayyar hai"); onCreated(); }}><Sparkles size={16} /> Make my script</button></div></div>; }

function ProjectCard({ project, index }: { project: { title: string | null; idea: string; ready?: number; total?: number }; index: number }) { return <button className="vp-project-card"><div className={`vp-project-art art-${index}`}><span className="vp-play"><Play size={16} fill="currentColor" /></span><span className="vp-duration">{index === 0 ? "00:24" : index === 1 ? "01:12" : "00:45"}</span></div><div className="vp-project-card-copy"><div><b>{project.title || project.idea}</b><small>{project.ready ?? 0}/{project.total ?? 0} scenes ready</small></div><ChevronRight size={16} /></div></button>; }
function EmptyProjectCard() { return <div className="vp-empty-project"><span><Film size={23} /></span><div><b>Your first project starts here</b><p>Idea likhein aur Vision Pilot ko baqi kaam karne dein.</p></div></div>; }
function Projects({ projects, onBack }: { projects: Array<{ id: string; title: string | null; idea: string; ready?: number; total?: number }>; onBack: () => void }) { return <div className="vp-content-wrap"><PageTitle eyebrow="Creative library" title="My projects" description="Aap ke tamam ideas aur generated videos ek jagah." onBack={onBack} /><div className="vp-library-toolbar"><div className="vp-search"><Search size={16} /><input placeholder="Projects dhoondein" /></div><button className="vp-outline-button" onClick={onBack}><Plus size={16} /> New project</button></div><div className="vp-project-grid vp-library-grid">{projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index % 3} />)}{!projects.length && <EmptyProjectCard />}</div></div>; }
function Memories({ projects, onBack }: { projects: Array<{ id: string; title: string | null; idea: string; ready?: number; total?: number }>; onBack: () => void }) {
  const [filter, setFilter] = useState("Sab");
  const filters = ["Sab", "Ideas", "Scripts", "Projects"];
  const memories = projects.map((project) => ({
    ...project,
    type: project.total ? "Projects" : "Ideas",
  })).filter((memory) => filter === "Sab" || memory.type === filter);

  return <div className="vp-content-wrap">
    <PageTitle eyebrow="Stored creativity" title="Memories" description="Aapki ideas, scripts aur project parts — dobara istemal ke liye mehfooz." onBack={onBack} />
    <div className="vp-memory-hero"><div className="vp-memory-hero-icon"><Brain size={24} /></div><div><b>Vision Pilot ko yaad rehta hai</b><p>Ideas ko save karein, storyline ke parts alag rakhein, aur simple command se unhein naye project mein jor dein.</p></div><button className="vp-primary-button" onClick={onBack}><Sparkles size={15} /> New idea</button></div>
    <div className="vp-memory-toolbar"><div className="vp-memory-filters">{filters.map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><span>{memories.length} saved {memories.length === 1 ? "memory" : "memories"}</span></div>
    <div className="vp-memory-list">{memories.map((memory, index) => <article className="vp-memory-row" key={memory.id}><span className={`vp-memory-row-icon memory-${index % 3}`}><BookOpen size={17} /></span><div className="vp-memory-copy"><div><b>{memory.title || memory.idea}</b><span>{memory.type}</span></div><p>{memory.idea}</p><small>{memory.ready ?? 0}/{memory.total ?? 0} project parts ready</small></div><button className="vp-memory-use" onClick={() => { toast.success("Memory composer mein add ho gayi"); onBack(); }}>Use <ArrowUpRight size={14} /></button></article>)}{!memories.length && <div className="vp-empty-project"><span><BookOpen size={23} /></span><div><b>Abhi koi memory save nahi</b><p>Studio mein idea likhein — Vision Pilot usay yahan yaad rakhega.</p></div></div>}</div>
    <div className="vp-memory-note"><Check size={16} /><p><b>Memories = Your stored creativity.</b> Har saved idea future film, game ya app ka starting point ban sakta hai.</p></div>
  </div>;
}

function Development({ onBack }: { onBack: () => void }) {
  const checks = ["Idea ko research aur plan mein badalna", "React website, AI app ya game ka live preview", "Testing aur security checks", "Downloadable project output"];
  return <div className="vp-content-wrap">
    <PageTitle eyebrow="Build · Create · Launch" title="Development workspace" description="Idea se tested project tak — Vision Pilot aur Dev Master saath kaam karte hain." onBack={onBack} />
    <section className="vp-development-card"><div className="vp-development-heading"><span className="vp-development-icon"><Code2 size={24} /></span><div><p className="vp-kicker">Development option</p><h2>Apna project banayein</h2><p>Chat Box mein seedha command dein. Vision Pilot research karega, Dev Master build karega, aur live preview yahin dikhayega.</p></div></div><div className="vp-development-grid"><div className="vp-development-checks">{checks.map((item) => <div key={item}><span><Check size={14} /></span><p>{item}</p></div>)}</div><div className="vp-development-launch"><span className="vp-live-dot" /><b>Build system ready</b><p>Website, game ya AI app ke liye workspace kholen.</p><button className="vp-primary-button" onClick={onBack}>Start building <ArrowUpRight size={15} /></button></div></div></section>
    <div className="vp-development-tools"><article><span><TestTube2 size={18} /></span><div><b>Testing included</b><p>Build ke baad preview aur checks ke saath result dekhein.</p></div></article><article><span><Bot size={18} /></span><div><b>Dev Master learns</b><p>Kami aaye to validated capability seekh kar dobara try karta hai.</p></div></article><article><span><FolderOpen size={18} /></span><div><b>Ready to export</b><p>Apna completed project download karke aage le jayein.</p></div></article></div>
  </div>;
}

function Apps({ onBack }: { onBack: () => void }) { return <div className="vp-content-wrap"><PageTitle eyebrow="Your toolkit" title="Connected apps" description="Jin services ke saath Vision Pilot kaam kar sakta hai." onBack={onBack} /><ConnectedApps /></div>; }
function PageTitle({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) { return <div className="vp-page-heading vp-inner-title"><div><button className="vp-back-button" onClick={onBack}>← Studio</button><p className="vp-kicker">{eyebrow}</p><h1>{title}</h1><p className="vp-subtitle">{description}</p></div></div>; }
