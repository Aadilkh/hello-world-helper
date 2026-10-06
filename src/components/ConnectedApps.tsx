import { useState } from "react";
import { Bot, Cloud, Code2, ExternalLink, FolderGit2, Link2, Mail, MessageCircle, Play, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const categories = ["Sab", "Social", "Storage", "Messages", "AI", "Development"] as const;
type Category = typeof categories[number];
const apps: { name: string; category: Category; purpose: string; url?: string }[] = [
  { name: "YouTube", category: "Social", purpose: "Channel ki videos aur content upload", url: "https://www.youtube.com" },
  { name: "Facebook", category: "Social", purpose: "Page content aur reels", url: "https://www.facebook.com" },
  { name: "Instagram", category: "Social", purpose: "Reels, photos aur account content", url: "https://www.instagram.com" },
  { name: "TikTok", category: "Social", purpose: "Short videos aur publishing", url: "https://www.tiktok.com" },
  { name: "Telegram", category: "Messages", purpose: "Messages aur files bhejna", url: "https://telegram.org" },
  { name: "TeraBox", category: "Storage", purpose: "Files aur download links", url: "https://www.terabox.com" },
  { name: "Diskwala", category: "Storage", purpose: "Files aur external storage" },
  { name: "Google Drive", category: "Storage", purpose: "Videos, projects aur backups save karna", url: "https://drive.google.com" },
  { name: "Gmail", category: "Messages", purpose: "Emails aur attachments", url: "https://mail.google.com" },
  { name: "WhatsApp", category: "Messages", purpose: "Messages aur content share karna", url: "https://www.whatsapp.com" },
  { name: "IMO", category: "Messages", purpose: "Messaging aur sharing", url: "https://imo.im" },
  { name: "X", category: "Social", purpose: "Posts, videos aur audience content", url: "https://x.com" },
  { name: "ChatGPT", category: "AI", purpose: "AI se ideas aur jawab", url: "https://chatgpt.com" },
  { name: "Gemini", category: "AI", purpose: "AI research aur content madad", url: "https://gemini.google.com" },
  { name: "Meta AI", category: "AI", purpose: "AI ideas aur content madad", url: "https://www.meta.ai" },
  { name: "DeepSeek", category: "AI", purpose: "AI reasoning aur coding madad", url: "https://www.deepseek.com" },
  { name: "Qwen", category: "AI", purpose: "AI coding aur language madad", url: "https://qwen.ai" },
  { name: "Replit", category: "Development", purpose: "Projects banana aur chalana", url: "https://replit.com" },
  { name: "Lovable", category: "Development", purpose: "Apps aur websites banana", url: "https://lovable.dev" },
  { name: "GitHub", category: "Development", purpose: "Project code aur versions save karna", url: "https://github.com" },
];
const icons = { Sab: Link2, Social: Video, Storage: Cloud, Messages: MessageCircle, AI: Bot, Development: Code2 };

export function ConnectedApps() {
  const [category, setCategory] = useState<Category>("Sab");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof apps[number] | null>(null);
  const filtered = apps.filter((app) => (category === "Sab" || app.category === category) && app.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <section aria-labelledby="connected-apps-title" className="mt-8 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="connected-apps-title" className="font-display text-lg font-bold">Connected Apps</h2>
        <span className="text-xs text-muted-foreground">0/20 connected</span>
      </div>
      <div className="relative mt-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input aria-label="App dhoondein" placeholder="App dhoondein" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1" aria-label="App categories">
        {categories.map((item) => <Button key={item} size="sm" variant={category === item ? "secondary" : "ghost"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {filtered.map((app) => {
          const Icon = app.name === "Gmail" ? Mail : app.name === "YouTube" ? Play : app.name === "GitHub" ? FolderGit2 : icons[app.category];
          return <Button key={app.name} variant="outline" aria-label={`${app.name} details`} onClick={() => setSelected(app)} className="h-28 min-w-0 flex-col gap-2 whitespace-normal px-1.5 py-3">
            <Icon className="text-primary" />
            <span className="min-h-8 w-full break-words text-center text-xs leading-4">{app.name}</span>
            <span className="text-[10px] text-muted-foreground">Not connected</span>
          </Button>;
        })}
      </div>
      {!filtered.length && <p className="py-8 text-center text-sm text-muted-foreground">Koi app nahi mili.</p>}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.category} · Not connected</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Maqsad</p>
            <p className="text-muted-foreground">{selected?.purpose}</p>
            <p className="font-medium">Connection abhi tayyar nahi</p>
            <p className="text-muted-foreground">Is app ka account Vision Pilot se abhi nahi jura. Account ki ijazat aur connection setup ke baad hi files, messages ya uploads ka kaam chalega.</p>
            <p className="text-xs text-muted-foreground">App ki website par login karna Vision Pilot ko account ki access nahi deta.</p>
          </div>
          {selected?.url && <Button asChild variant="outline"><a href={selected.url} target="_blank" rel="noopener noreferrer"><ExternalLink />App ki website kholein</a></Button>}
        </DialogContent>
      </Dialog>
    </section>
  );
}