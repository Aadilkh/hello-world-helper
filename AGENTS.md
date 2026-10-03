<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Self-upgrade engine (Cell 8) stores learned capabilities as validated prompt rules in the capabilities table, never as executable code — Workers can't safely run generated code.
- Analyze user-provided videos by sampling timestamped frames in the browser before server-side vision analysis, because the Worker cannot run native video decoders and third-party embeds often block frame access.
