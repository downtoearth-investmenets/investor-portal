# Down to Earth — interactive terrain login

The approved mockup is the visual reference. The implementation uses local terrain assets baked by `scripts/build-login-terrain.py` (Python with NumPy, Pillow and pyshp); the app does not contact the geographic data providers at runtime.

## Page and behavior

- Keep a near-half split at desktop sizes: inset terrain on the left, an unboxed form on the right, forest and sage against warm ivory. Reuse the mountain wordmark inside the map. The right panel starts with **Sign in**, with no icon above it. Keep email, password reveal, password recovery and one submit button. Remove the public demo picker and its client-side autofill code. Existing demo accounts can still be used manually in the local environment.
- Keep the desktop page in one viewport at normal zoom. On narrow screens, put the form first and use a compact static map preview. Keep the submit button reachable on short screens, at high browser zoom, and when the phone keyboard is open; allow vertical scrolling in those cases.
- Start with Colorado selected. The Colorado, Wisconsin and Michigan markers open concise regional previews. Desktop visitors can drag to pan, zoom with buttons, and reset the view. Keep north up and limit pan and zoom so the user cannot move beyond the terrain. Preserve normal page scrolling and browser zoom outside the map.
- The map uses public geography and broad state anchors only. It has no parcel pins, real investment routes, balances, investor information, or connection to authenticated APIs.

## Motion direction: the survey trace

| Trigger | Motion |
| --- | --- |
| First ready frame | Match the static poster's composition. Fade the live scene in over about 200 ms; let the ridge catch a hint of light as the camera settles by a few degrees. |
| First visit to the login screen | An amber point draws a short sage contour along the Colorado ridge over about 1.2 seconds. Leave the completed contour softly visible, then stop animating. The trace is decorative. |
| State selection | Move the orthographic camera and target together over about 450 ms; keep the same north-up orientation and keep the overview legible. Add one short pulse to the selected marker and show its preview. A new selection or direct map interaction cancels the previous movement. |
| Reset | Return to the overview framing and initial selection without replaying the introduction. |
| Reduced motion | Show the completed trace immediately. Selection and reset update the view without camera travel or a pulse. |

The form appears in its final position from the start. The intro runs once per mounted visit, never on form edits, validation, zoom, or state selection. Do not animate the map while idle.

## Implementation sequence

1. **Refit the login view.** Keep `app/login/page.tsx` thin. Give `AuthLoginView` a login-specific layout and reuse the existing fields, button, brand and theme tokens. `AuthShell` also serves password recovery and invite setup; leave those layouts alone. Keep the existing sign-in view model's validation, errors, loading, and investor/admin redirects; remove only its demo autofill branch and now-unused demo constants. No gateway or service changes.
2. **Create the terrain and poster together.** Use a cropped USGS 3DEP elevation grid, simplified Census boundaries and Natural Earth lakes in the same geographic extent. Resample to a small indexed terrain mesh, exaggerate relief modestly, and bake contour and hillshade detail into a forest/sage texture. Reuse that texture for the overview poster so the swap keeps the same framing. The approved image is an art reference, not geographic source data. [USGS 3DEP](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) · [Census cartographic boundaries](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html) · [Natural Earth lakes](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-lakes-reservoirs/)
3. **Load the scene independently.** In the login feature, use a client-only dynamic import for the map canvas. Render the poster at its final dimensions immediately; start loading 3D only on eligible desktop layouts. Use Three.js for the indexed mesh, orthographic camera and contour line; React Three Fiber for scene lifecycle. The lockfile resolves React 18.3.1 and Next.js 14.2.35, so choose R3F v8 and a tested compatible Three.js version with matching type definitions. [R3F installation](https://r3f.docs.pmnd.rs/getting-started/installation) · [Next.js 14 lazy loading](https://nextjs.org/docs/14/app/building-your-application/optimizing/lazy-loading)
4. **Wire controls and choreography.** Keep region metadata and selection inside the login feature, with camera and rendering details owned by the map view. Use one camera controller for pan, zoom and scripted moves. Use GSAP to tween camera state and contour progress; a pre-sampled curve drives both the amber tip and the Three.js line draw range. Call R3F's `invalidate()` on animation/control updates with `frameloop="demand"`. Revert animation scopes and dispose listeners and graphics resources on navigation. Use native HTML buttons for projected region markers and zoom/reset controls so they support keyboard and screen readers. Keep regional previews available through the same region actions in the static fallback. [R3F performance guide](https://r3f.docs.pmnd.rs/advanced/scaling-performance) · [GSAP React guidance](https://gsap.com/resources/React/) · [GSAP reduced motion](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/)
5. **Check the fallback and the production build.** Keep the poster visible until the scene has drawn, and restore it if WebGL is unavailable, initialization or asset loading fails, or the context is lost. The fallback keeps the regional overview available and omits controls that require a live camera. Keep map assets out of the form's critical load. Start with a device pixel ratio cap of 1.5, one terrain mesh, and no postprocessing or real-time shadows. Profile the production build on a laptop with integrated graphics before adding more detail.

## Acceptance checks

- At 1440×900 and 1366×768, desktop login fits without page scrolling. At phone widths, 200% zoom and with the on-screen keyboard open, the form and recovery link are reachable.
- The form is usable with a deliberately delayed or failed map load. Valid admin and investor accounts reach the correct dashboard; invalid credentials and field errors stay visible. Password reveal and recovery still work. No signup, social login, or demo picker appears.
- Keyboard users can reach and operate the markers and controls; focus stays visible, region details are announced, and the map does not trap focus. Check reduced motion, quick region changes, interrupted motion, reset, and navigation away and back.
- Verify no live canvas on the mobile layout, no continuous frames after motion stops, and a working poster after simulated WebGL failure. Compare production bundle and network traces with the current login baseline to confirm the renderer is not required for the form. Run the web type check, Next.js build and feature boundary check.
