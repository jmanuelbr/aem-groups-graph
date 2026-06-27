# Groups Membership Graph

An AEM as a Cloud Service author-side admin tool that visualises, for any selected principal
(user **or** group), every group it belongs to — directly and through nested memberships — as an
interactive graph, with nodes coloured by how many membership hops away each group is.

AEM makes it hard to see *at a glance* all the groups a user effectively belongs to, especially the
ones inherited via membership in other groups. This tool answers "which groups is this principal in,
and where does each membership come from?" visually.

## What it does

- **Principal picker** — the OOTB Granite authorizable autocomplete
  (`granite/ui/components/coral/foundation/authorizable/autocomplete`, the same field AEM's
  "Impersonate as" uses), which searches users and groups via its built-in suggestion endpoint.
- **Membership graph** — on selection, walks the `memberOf` direction breadth-first and renders the
  result with [Cytoscape.js](https://js.cytoscape.org/) using a `breadthfirst` layout rooted at the
  principal.
- **Depth colouring** — each group is coloured by its **shortest-path** distance (number of hops)
  from the principal; the selected principal is the highlighted root.
- **Show out-of-the-box groups** — a toggle that, when checked, reveals the groups that ship with
  AEM, matched against an explicit curated list of OOTB group ids (`everyone`, `contributor`,
  `workflow-users`, `dam-*`, `projects-*`, etc.) plus anything under `/home/groups/system`.
  **Unchecked by default**, so the graph focuses on the customer's own groups; the selected
  principal (root) is always shown even if it is itself a built-in group. The curated list lives in
  `MembershipGraphServiceImpl.BUILTIN_GROUP_IDS`.
- **Hover to trace** — hovering a group highlights every membership path back to the principal and
  dims the rest, so you can see exactly where an inherited membership comes from.
- **Click for details** — clicking a node opens a panel with its id, path, type, depth, and direct
  parent groups.
- Smooth animated layout and transitions on load and on every visual change.

## Where to find it

After deploying to an AEM author instance, open **Tools → Security → Groups Membership Graph**, or
go directly to:

    /apps/groupsgraph/content/membership-graph.html

## Architecture

| Concern            | Implementation |
|--------------------|----------------|
| Traversal          | `MembershipGraphService` / `MembershipGraphServiceImpl` — BFS over `Authorizable.declaredMemberOf()` (shortest-path depth, visited-set guard, node cap). |
| Data endpoint      | `GraphDataServlet`, bound by resource type `groupsgraph/endpoints/graph`. Returns `{rootId, nodes, edges, truncated}` JSON. Called as `/apps/groupsgraph/endpoints/graph.json?principal=<id>`. |
| Principal suggestions | Provided entirely by the OOTB authorizable autocomplete's own endpoint — no custom servlet. |
| Page               | A plain `sling:Folder` resource at `/apps/groupsgraph/content/membership-graph` with `sling:resourceType=groupsgraph/components/page`; the `page.html` HTL renders the full document and loads the Coral + tool client libraries. (Not a `cq:Page`, so AEM does not wrap it in the page renderer.) |
| Client library     | `groupsgraph.tool` (`/apps/groupsgraph/clientlibs/clientlib-tool`) — Cytoscape.js + `graph.js` + `graph.css`. |
| Tools menu entry   | Overlay at `/apps/cq/core/content/nav/tools/groupsgraph`. |

### Security model

- **All data is read with the caller's own `ResourceResolver`** (their session), so the graph can
  only ever contain principals the signed-in user is already allowed to see. No service user is
  used.
- **Admin-only.** Both endpoints reject non-administrators (`PrincipalAccess.isAdmin`), and the page
  renders an access-denied notice for non-administrators via `ToolAccessModel`.
- Note: this enforces admin-only access in the **servlets and the page** rather than via a JCR ACL
  on `/apps`, because hard ACLs on the immutable `/apps` tree are discouraged on AEMaaCS. The
  effective behaviour is the same.

## Project layout

This started from the AEM Project Archetype (v54, `aemVersion=cloud`) and was pruned to the modules
an admin tool actually needs:

- `core` — the Java bundle (services, servlets, model). **Java 21.**
- `ui.apps` — components, client library, the tool page, endpoint nodes, Tools overlay.
- `ui.apps.structure` — repository structure package.
- `ui.config` — run-mode OSGi config.
- `all` — single deployable container package.

The archetype's `ui.frontend`, `ui.content`, `it.tests`, and `ui.tests` modules were removed.

## How to build

    mvn clean install

To build and deploy the `all` package to a local AEM author instance:

    mvn clean install -PautoInstallSinglePackage

(Use `-Daem.port=4502` etc. to target a specific instance.)

> **Build/runtime requires JDK 21.** The compiler target is set to `release=21`; run the AEMaaCS SDK
> quickstart on a Java 21 runtime.
