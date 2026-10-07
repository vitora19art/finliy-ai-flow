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

- Use one shared image logo backed by an asset pointer so image replacements update the header and sidebar together.
- Text and uploaded entries share the transaction store and metric engine so reports use one financial base.
- Each financial-table message owns its export target so older messages export the correct table.
