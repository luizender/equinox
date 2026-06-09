---
name: new-component
description: Create a new React component for Equinox that matches the project's shadcn (base-nova) + Base UI + Tailwind v4 conventions. Use when adding a UI primitive or a feature component.
disable-model-invocation: true
---

# New component for Equinox

Equinox is Next.js 16 (App Router, RSC) + React 19 + Tailwind CSS v4, styled with **shadcn** on the `base-nova` style over **Base UI** primitives (`@base-ui/react`). Icons come from **lucide-react**. Config lives in `components.json`; the `@/*` alias maps to `src/*`.

## First: primitive or feature component?

- **shadcn UI primitive** (button, dialog, input, …) → it belongs in `src/components/ui/`. **Prefer pulling it from the registry** rather than hand-writing:
  ```bash
  npx shadcn@latest add <name>
  ```
  (or ask the `shadcn` MCP server for it). Only hand-write if it isn't in the registry.
- **Feature component** (dashboard widget, chart, panel — like `kpi-cards.tsx`, `simulation-panel.tsx`, `allocation-chart.tsx`) → it belongs directly in `src/components/`.

## Conventions to follow

Match the existing files (`src/components/ui/button.tsx` is the canonical reference):

- **Server by default.** Omit `'use client'`. Add it only when the component uses state, effects, event handlers, or browser APIs. Charts (`recharts`) and interactive panels are client components; static display can stay server.
- **Class merging:** always compose classes with `cn(...)` from `@/lib/utils` — never concatenate strings manually.
- **Variants:** use `class-variance-authority` (`cva`) with a `variants` + `defaultVariants` block, and export both the component and its `xxxVariants`, exactly like `buttonVariants`. Type props as `Primitive.Props & VariantProps<typeof xxxVariants>`.
- **Primitives:** build UI primitives on top of `@base-ui/react/<primitive>`, not raw HTML, and forward `...props`. Set a `data-slot="<name>"` attribute (the codebase keys styling off `data-slot` / `data-[icon=…]`).
- **Function declarations, named exports.** `function MyComponent(...) { … }` then `export { MyComponent }`. No default exports for components.
- **Styling:** Tailwind v4 utility classes with the project's design tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `ring-ring`, `focus-visible:*`, `dark:*`). Reuse existing tokens; don't invent colors.
- **Icons:** import from `lucide-react`; size via the `[&_svg]` patterns already in the variants rather than hardcoding when inside a primitive.
- **TypeScript:** fully typed props; no `any`. Keep it RSC-safe (no client-only imports in a server component).

## Steps

1. Decide primitive vs. feature (above). For a registry primitive, run `npx shadcn@latest add <name>` and stop — it lands styled in `src/components/ui/`.
2. Create the file (`src/components/ui/<name>.tsx` or `src/components/<name>.tsx`).
3. Implement following the conventions; reuse `@/components/ui/*` primitives instead of re-styling.
4. Use it from a page/parent and verify: `yarn typecheck && yarn lint`, then `yarn dev` to eyeball it (light + dark).

## Done when

The component renders in the app, `yarn typecheck` and `yarn lint` pass, and it visually matches the existing `base-nova` components in both light and dark mode.
