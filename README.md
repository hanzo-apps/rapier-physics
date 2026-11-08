# Fracture Yard — Rapier3D physics sandbox

<!-- hanzo-badges -->
<p align="left">
  <a href="https://platform.hanzo.ai/new?repo=https%3A%2F%2Fgithub.com%2Fhanzo-apps%2Frapier-physics&template=rapier-physics"><img src="https://gallery.hanzo.ai/deploy.svg" alt="Deploy to Hanzo" height="32" /></a>
  <a href="https://hanzo.ai/chat?template=rapier-physics"><img src="https://gallery.hanzo.ai/badges/edit-in-hanzo.svg" alt="Edit in Hanzo.ai" height="32" /></a>
  <a href="https://gallery.hanzo.ai/templates/rapier-physics"><img src="https://gallery.hanzo.ai/badges/live-preview.svg" alt="Live Preview" height="32" /></a>
  <a href="https://gallery.hanzo.ai/llms/rapier-physics/LLM.md"><img src="https://gallery.hanzo.ai/badges/llm-md.svg" alt="LLM.md Playbook" height="32" /></a>
</p>
<!-- /hanzo-badges -->

A real rigid-body sandbox: Rapier3D (Rust compiled to WebAssembly) owns the simulation and
three.js only draws it. Click to fire a heavy CCD-enabled ball at a 112-block tower, press
R to rebuild. The HUD reports live body count and per-step solver cost.

Live: https://rapier-physics.hanzo.app

The split is the lesson: physics state lives in WASM and is read back once per frame, so
the JS side stays a renderer and the simulation stays deterministic and fast.

## Build

```sh
npm install && npm run build
```

## Deploy to hanzo.app

An engine build is far bigger than the 4 MiB the public edge accepts in one request
body, so games ship through the **release lane**, not the artifact lane: put the built
tree in your object space, then publish it server-side.

```sh
# 1. declare the engine — `unity`, `unreal`, `godot` make clients/sites serve the
#    site cross-origin-isolated (COOP/COEP) so multithreaded WASM gets SharedArrayBuffer
curl -X POST https://api.hanzo.ai/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG" -H "Content-Type: application/json" \
  -d "{\"slug\":\"my-game\",\"name\":\"my-game\",\"framework\":\"godot\"}"

# 2. stage the build to s3.hanzo.ai under <org>/_stage/my-game/
# 3. promote it into an immutable content-addressed release + flip the pointer
curl -X POST https://api.hanzo.ai/v1/sites/my-game/publish -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG" -H "Content-Type: application/json" -d "{\"source\":\"_stage/my-game\"}"
```

**Fingerprint your asset names.** The site server serves a content-hashed filename
`immutable` and everything else with a plain `max-age`. A redeploy that reuses the same
asset name leaves browsers and the CDN running the OLD loader against the NEW binary —
for a WASM app that is a silent, permanent hang with no error, not a visible failure.

## License

MIT (this sandbox). Rapier is Apache-2.0, (c) Dimforge. three.js is MIT.
