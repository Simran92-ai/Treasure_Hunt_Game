# Treasure Hunt 

A browser game with two renderers on the same game logic:

- **2D view** — HTML5 Canvas, hand-written 2D pipeline.
- **3D view (Enhanced)** — hand-written WebGL2 engine: PBR materials, real-time shadows, dynamic lights, fog, water, bloom.

No frameworks, no build step, no server needed. Open `index.html` (works from `file://`). 3D needs a WebGL2 browser; if it is missing the game stays in 2D.
Bootstrap 5 (grid + utilities only) is loaded from a CDN for the responsive layout; `src/css/style.css` contains a fallback if offline.

## Folder structure

```
Computer_Graphics_Treasure_Hunt_Game/
├── index.html                  Entry page: all screens + <script> tags (load order matters)
├── README.md
├── cpp/                        C++ → WebAssembly level generator
│   ├── levelgen.cpp            Source (BSP rooms, flood fill, BFS fields, patrol pairs)
│   ├── levelgen.wasm           Compiled module
│   └── build.sh                Rebuilds .wasm and regenerates src/js/level/levelgen_wasm.js
└── src/
    ├── css/
    │   └── style.css           All styling (menus, HUD, CG panel, touch controls, responsive)
    └── js/                     Plain scripts on one global namespace `TH` (no ES modules)
        ├── core/               Game loop + state + shared algorithms
        │   ├── main.js         Boot, inline-handler exports, auto-pause, resize
        │   ├── game.js         Start/stop/pause/restart, main loop, 2D/3D view switching
        │   ├── gameState.js    Shared state, difficulty config (timers, AI speed), reset
        │   ├── cg.js           CG algorithms: Cohen–Sutherland, Liang–Barsky, Bresenham, 3×3 matrices, live stats
        │   ├── pathfinding.js  A* (binary heap, hazard cost)
        │   ├── collision.js    AABB tile collision, safe world-switch nudge
        │   ├── score.js        Score, time bonus, best scores
        │   └── timer.js        Countdown / no-limit handling, mm:ss format
        ├── gameplay/           Rules and entities
        │   ├── player.js       Movement, fog-of-war reveal
        │   ├── computerOpponent.js  AI racer (A*), works across Mirror World
        │   ├── obstacles.js    Patrolling monsters, hunters (line-of-sight chase), damage
        │   ├── collectibles.js Coins, clues, keys, checkpoints, hazards, doors, treasure
        │   └── hints.js        Four hint tiers
        ├── level/              Procedural level generation
        │   ├── levelgen.js     JS wrapper around the WASM module (+ identical JS fallback)
        │   ├── levelgen_wasm.js  Generated: wasm as base64 (so it runs from file://)
        │   ├── themes.js       Per-map and per-difficulty monsters, obstacles, hazards, rules
        │   └── maps.js         Map metadata + builders, solvability validation
        ├── render2d/           Canvas renderer
        │   ├── renderer.js     World render, minimap, lighting, camera transform
        │   ├── sprites2d.js    Obstacles, monsters, hazards, pickups drawn with canvas paths
        │   ├── camera.js       Smooth camera
        │   └── animation.js    Bob/sway and win scene
        ├── render3d/           WebGL2 renderer
        │   ├── gl3d.js         Engine: shaders, PBR, shadow map, MSAA, bloom, tone mapping
        │   ├── textures3d.js   Procedural tileable textures + normal maps
        │   ├── rigs3d.js       3D obstacle models, hierarchical monster/player rigs
        │   └── scene3d.js      Builds and renders the level in 3D, camera, lights, particles
        └── ui/                 DOM UI
            ├── ui.js           Settings, navigation, HUD, results, toasts, panel minimizing
            ├── cgpanel.js      Live "CG concepts" box
            └── touchControls.js  On-screen arrows, camera-rotate and world-switch buttons
```

## How to play

1. **Map Selection** → pick a map → pick a mode:
   - **Solo Challenge · No time limit**
   - **Solo Challenge · With time limit**
   - **Vs Computer · With time limit** (race an A* opponent)
2. Pick a difficulty. Timed: Easy 15 min (32×22), Medium 10 min (40×26), Hard 5 min (48×30). No-limit games use the same map sizes without a timer.
3. Find the **clue / map piece** → the **key** appears (map + minimap) → take the key → the **treasure** appears → unlock the door and reach it.

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | on-screen arrows (only while playing) |
| Switch world (Mirror World map only) | `M` | `M` button (only on Mirror World) |
| 2D ↔ 3D | `V` | **3D View / 2D View** button |
| Rotate camera (3D) | `Q` / `E`, drag, mouse wheel zoom | rotate buttons |
| Pause | `P` / `Esc` | Pause button |

Pause → **Instructions** / **Settings** → back returns to the pause menu (Resume / Restart / …).

### Settings

Animations · Minimap · 3D View (default on; enables the in-game 2D/3D switch) · Instructions / Info Window · CG Concepts Box (default off) · 3D Quality (Low / Medium / High). The game itself always starts in 2D. Settings are saved in the browser.
The info window and the minimap can also be minimized in-game with their `−` buttons.

## Maps and difficulty

Six maps: Lost Jungle, Haunted Mansion, Pirate Island, City Detective, Abandoned Space Station, Mirror World (two linked worlds). Every map has its own obstacles, monsters and hazards, and these differ for Easy, Medium and Hard. Higher difficulty = bigger map, denser obstacles, more and faster monsters, and hunters that chase on line of sight. Levels are generated per (map, difficulty) and always validated as solvable.

## Computer graphics concepts used

2D: 2D transformations (translate/scale/rotate/reflect) and a live 3×3 matrix, window→viewport mapping, Cohen–Sutherland clipping, Liang–Barsky line clipping, Bresenham line-of-sight, painter's algorithm, alpha blending, radial lighting, interpolation.
3D: perspective projection, 4×4 view matrix, orbit camera, hierarchical model transforms, frustum culling, PBR lighting (GGX/Fresnel), shadow mapping with PCF, texture and normal mapping with mipmaps, exponential fog, MSAA, bloom and ACES tone mapping, depth buffer, see-through zone around the player.
Switch on **Show CG Concepts Box** in Settings to see these with live values while playing.

## Rebuilding the C++ module (optional)

The compiled module is already embedded. To change `cpp/levelgen.cpp`:

```sh
cd cpp && ./build.sh      # needs clang with the wasm32 target and wasm-ld, and Node
```

If WebAssembly is unavailable, `levelgen.js` falls back to an identical JavaScript implementation.

## Animation ON vs OFF (Settings → Animations)

The toggle drives one shared clock. OFF freezes it at t = 0, so every time-based effect holds a still frame, in both views. Gameplay (movement, doors, damage blink, hint dashes) keeps working.

| Visual | ON | OFF |
|---|---|---|
| 2D water | shimmer colour, wave strokes, sparkles | flat blue tile |
| 2D obstacles | gentle sway rotation | upright, still |
| 2D player/AI/creatures | walk swing, idle bob, wing/leg cycles | static pose, no bob |
| 2D pickups / hazards | float, spin, glow pulse, fire/spike/laser cycles | frozen frame |
| 2D reflection under player | drawn | hidden |
| 2D theme effects | mansion lantern flicker, space-station red pulse, jungle light shafts | removed / steady |
| 3D water, sky | flowing normals + foam, drifting clouds, twinkling stars, aurora | frozen |
| 3D foliage | wind sway | rigid |
| 3D characters / creatures | walk and idle animation | still pose |
| 3D pickups / hazards | bob, spin, fire, spike, laser | frozen frame |
| 3D lights | torch / lantern / fire flicker | steady |
| 3D particles | drift, firefly wander, twinkle | static |

A toast shows the change when you toggle it, and the CG panel has an "Animation (setting)" row.
