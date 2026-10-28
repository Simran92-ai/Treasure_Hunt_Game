// levelgen.cpp  -  procedural level generator, compiled to WebAssembly.
//
// Freestanding C++ (no libc, no allocations): fixed static buffers shared with
// JavaScript through linear memory.  JS fills G (tile chars) + R (reserved
// mask), calls the exported functions, and reads the result back.
//
// Algorithms used:
//   * BSP space partitioning  -> rooms / city blocks with door gaps
//   * Flood-fill labelling    -> connectivity guarantee after every edit
//   * Cluster scatter         -> obstacles that never seal the level
//   * BFS distance field      -> fair placement of clue / key / patrols
//
// Build: see build.sh   (clang --target=wasm32, no emscripten needed)

typedef unsigned char u8;
typedef unsigned int  u32;
typedef int           i32;

#define MAXW 64
#define MAXH 64
#define MAXN (MAXW * MAXH)

static u8  G[MAXN];      // tile chars   ('#' wall, '.' floor, '~' water, 'O' obstacle, 'D' door ...)
static u8  R[MAXN];      // reserved mask (1 = generator must not touch)
static i32 D[MAXN];      // BFS distance (-1 unreachable)
static i32 DS[MAXN];     // BFS distance from the level start
static i32 L[MAXN];      // component labels
static i32 Q[MAXN];      // queue / stack
static i32 OUT[1024];    // result pairs
static u32 S = 2463534242u;

static i32 W = 0, H = 0;

static inline u32 rnd() { S ^= S << 13; S ^= S >> 17; S ^= S << 5; return S; }
static inline i32 rint(i32 n) { return n <= 0 ? 0 : (i32)(rnd() % (u32)n); }
static inline bool passable(u8 c) { return c != '#' && c != 'O' && c != '~'; }
static inline bool inb(i32 x, i32 y) { return x >= 0 && y >= 0 && x < W && y < H; }

static const i32 DX[4] = {1, -1, 0, 0};
static const i32 DY[4] = {0, 0, 1, -1};

// ---- connected components of passable tiles -------------------------------
static i32 label() {
    for (i32 i = 0; i < W * H; i++) L[i] = -1;
    i32 n = 0;
    for (i32 s = 0; s < W * H; s++) {
        if (L[s] != -1 || !passable(G[s])) continue;
        i32 qh = 0, qt = 0; Q[qt++] = s; L[s] = n;
        while (qh < qt) {
            i32 c = Q[qh++]; i32 cx = c % W, cy = c / W;
            for (i32 d = 0; d < 4; d++) {
                i32 nx = cx + DX[d], ny = cy + DY[d];
                if (!inb(nx, ny)) continue;
                i32 ni = ny * W + nx;
                if (L[ni] != -1 || !passable(G[ni])) continue;
                L[ni] = n; Q[qt++] = ni;
            }
        }
        n++;
    }
    return n;
}

// ---- BFS distance field ----------------------------------------------------
static i32 bfs_into(i32* dist, i32 sx, i32 sy) {
    for (i32 i = 0; i < W * H; i++) dist[i] = -1;
    if (!inb(sx, sy) || !passable(G[sy * W + sx])) return 0;
    i32 qh = 0, qt = 0; Q[qt++] = sy * W + sx; dist[sy * W + sx] = 0;
    while (qh < qt) {
        i32 c = Q[qh++]; i32 cx = c % W, cy = c / W;
        for (i32 d = 0; d < 4; d++) {
            i32 nx = cx + DX[d], ny = cy + DY[d];
            if (!inb(nx, ny)) continue;
            i32 ni = ny * W + nx;
            if (dist[ni] != -1 || !passable(G[ni])) continue;
            dist[ni] = dist[c] + 1; Q[qt++] = ni;
        }
    }
    return qt;
}

extern "C" {

__attribute__((used)) u8*  grid_ptr()    { return G; }
__attribute__((used)) u8*  reserve_ptr() { return R; }
__attribute__((used)) i32* dist_ptr()    { return D; }
__attribute__((used)) i32* out_ptr()     { return OUT; }
__attribute__((used)) void set_seed(u32 s) { S = s ? s : 2463534242u; for (int i = 0; i < 8; i++) rnd(); }
__attribute__((used)) u32  next_rand()   { return rnd(); }
__attribute__((used)) void set_size(i32 w, i32 h) { W = w; H = h; }

__attribute__((used)) i32 count_components() { return label(); }

// Open single wall tiles that separate two different components until the
// level is one connected region.  Returns the final component count.
__attribute__((used)) i32 ensure_connected() {
    for (i32 iter = 0; iter < 400; iter++) {
        i32 comps = label();
        if (comps <= 1) return comps;
        i32 total = W * H, off = rint(total), done = 0;
        for (i32 k = 0; k < total && !done; k++) {
            i32 i = (k + off) % total; i32 x = i % W, y = i / W;
            if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
            if (G[i] != '#' || R[i]) continue;
            i32 a = L[y * W + x - 1], b = L[y * W + x + 1];
            i32 c = L[(y - 1) * W + x], d = L[(y + 1) * W + x];
            if ((a >= 0 && b >= 0 && a != b) || (c >= 0 && d >= 0 && c != d)) { G[i] = '.'; done = 1; }
        }
        if (!done) return comps;
    }
    return label();
}

// BSP partition of the interior.  Walls with one door gap each (sometimes two).
// minRoom: smallest room side; stopPct: chance (0-100) to stop splitting small rooms.
__attribute__((used)) void bsp_rooms(i32 minRoom, i32 stopPct, i32 wideDoorPct) {
    i32 sp = 0; i32 st[256][4];
    st[sp][0] = 1; st[sp][1] = 1; st[sp][2] = W - 2; st[sp][3] = H - 2; sp++;
    while (sp > 0 && sp < 250) {
        sp--; i32 x0 = st[sp][0], y0 = st[sp][1], x1 = st[sp][2], y1 = st[sp][3];
        i32 rw = x1 - x0 + 1, rh = y1 - y0 + 1;
        bool canV = rw >= 2 * minRoom + 1, canH = rh >= 2 * minRoom + 1;
        if (!canV && !canH) continue;
        if (rw * rh < minRoom * minRoom * 5 && rint(100) < stopPct) continue;
        bool vertical;
        if (canV && canH) { if (rw * 10 > rh * 13) vertical = true; else if (rh * 10 > rw * 13) vertical = false; else vertical = rint(2) == 0; }
        else vertical = canV;
        if (vertical) {
            i32 x = x0 + minRoom + rint(rw - 2 * minRoom);
            for (i32 y = y0; y <= y1; y++) G[y * W + x] = '#';
            i32 dy = y0 + rint(rh); G[dy * W + x] = '.';
            if (rint(100) < wideDoorPct && dy + 1 <= y1) G[(dy + 1) * W + x] = '.';
            if (rh >= 12) { i32 d2 = y0 + rint(rh); G[d2 * W + x] = '.'; }
            st[sp][0] = x0; st[sp][1] = y0; st[sp][2] = x - 1; st[sp][3] = y1; sp++;
            st[sp][0] = x + 1; st[sp][1] = y0; st[sp][2] = x1; st[sp][3] = y1; sp++;
        } else {
            i32 y = y0 + minRoom + rint(rh - 2 * minRoom);
            for (i32 x = x0; x <= x1; x++) G[y * W + x] = '#';
            i32 dx = x0 + rint(rw); G[y * W + dx] = '.';
            if (rint(100) < wideDoorPct && dx + 1 <= x1) G[y * W + dx + 1] = '.';
            if (rw >= 12) { i32 d2 = x0 + rint(rw); G[y * W + d2] = '.'; }
            st[sp][0] = x0; st[sp][1] = y0; st[sp][2] = x1; st[sp][3] = y - 1; sp++;
            st[sp][0] = x0; st[sp][1] = y + 1; st[sp][2] = x1; st[sp][3] = y1; sp++;
        }
    }
    ensure_connected();
}

// Carve extra doorways through thin walls (creates loops / shortcuts).
__attribute__((used)) i32 add_doors(i32 count) {
    i32 made = 0;
    for (i32 a = 0; a < count * 60 && made < count; a++) {
        i32 x = 1 + rint(W - 2), y = 1 + rint(H - 2), i = y * W + x;
        if (G[i] != '#' || R[i]) continue;
        bool h = passable(G[i - 1]) && passable(G[i + 1]) && G[i - W] == '#' && G[i + W] == '#';
        bool v = passable(G[i - W]) && passable(G[i + W]) && G[i - 1] == '#' && G[i + 1] == '#';
        if (h || v) { G[i] = '.'; made++; }
    }
    return made;
}

// Scatter clusters of tile `ch` on free floor without ever splitting the level.
// spread: minimum Chebyshev distance between cluster seeds of the same tile.
__attribute__((used)) i32 scatter(i32 ch, i32 count, i32 maxCluster, i32 spread) {
    i32 placed = 0, base = label();
    for (i32 attempt = 0; attempt < count * 40 && placed < count; attempt++) {
        i32 x = 1 + rint(W - 2), y = 1 + rint(H - 2), i = y * W + x;
        if (G[i] != '.' || R[i]) continue;
        if (spread > 0) {
            bool near = false;
            for (i32 dy = -spread; dy <= spread && !near; dy++)
                for (i32 dx = -spread; dx <= spread; dx++) {
                    i32 nx = x + dx, ny = y + dy;
                    if (inb(nx, ny) && G[ny * W + nx] == (u8)ch) { near = true; break; }
                }
            if (near) continue;
        }
        i32 cells[16]; i32 n = 0; cells[n++] = i;
        i32 want = 1 + rint(maxCluster > 15 ? 15 : maxCluster);
        for (i32 t = 0; t < want * 4 && n < want; t++) {
            i32 from = cells[rint(n)], d = rint(4);
            i32 nx = from % W + DX[d], ny = from / W + DY[d];
            if (!inb(nx, ny) || nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
            i32 ni = ny * W + nx;
            if (G[ni] != '.' || R[ni]) continue;
            bool dup = false; for (i32 k = 0; k < n; k++) if (cells[k] == ni) dup = true;
            if (!dup) cells[n++] = ni;
        }
        for (i32 k = 0; k < n; k++) G[cells[k]] = (u8)ch;
        i32 now = label();
        if (now > base) { for (i32 k = 0; k < n; k++) G[cells[k]] = '.'; }
        else { base = now; placed++; }
    }
    return placed;
}

// BFS from (sx,sy) into D, also cached as the "from start" field.
__attribute__((used)) i32 bfs_start(i32 sx, i32 sy) {
    i32 n = bfs_into(D, sx, sy);
    for (i32 i = 0; i < W * H; i++) DS[i] = D[i];
    return n;
}

// Pick n floor tiles whose start-distance is in [minDist,maxDist], spaced >= minSep apart.
__attribute__((used)) i32 pick_points(i32 n, i32 minDist, i32 maxDist, i32 minSep) {
    i32 got = 0;
    for (i32 a = 0; a < 4000 && got < n; a++) {
        i32 x = 1 + rint(W - 2), y = 1 + rint(H - 2), i = y * W + x;
        if (G[i] != '.' || R[i]) continue;
        if (DS[i] < minDist || DS[i] > maxDist) continue;
        bool ok = true;
        for (i32 k = 0; k < got; k++) {
            i32 ex = OUT[2 * k] - x, ey = OUT[2 * k + 1] - y;
            if ((ex < 0 ? -ex : ex) + (ey < 0 ? -ey : ey) < minSep) { ok = false; break; }
        }
        if (!ok) continue;
        OUT[2 * got] = x; OUT[2 * got + 1] = y; got++;
    }
    return got;
}

// Patrol endpoint pairs: A is >= minStartDist from the start, B is a walkable
// distance [minLen,maxLen] from A.  OUT = ax,ay,bx,by, ...
__attribute__((used)) i32 patrol_pairs(i32 n, i32 minLen, i32 maxLen, i32 minStartDist, i32 sx, i32 sy) {
    bfs_start(sx, sy);
    i32 got = 0;
    for (i32 a = 0; a < n * 300 && got < n; a++) {
        i32 ax = 1 + rint(W - 2), ay = 1 + rint(H - 2), ai = ay * W + ax;
        if (G[ai] != '.' || R[ai] || DS[ai] < minStartDist) continue;
        bfs_into(D, ax, ay);
        for (i32 t = 0; t < 120; t++) {
            i32 bx = 1 + rint(W - 2), by = 1 + rint(H - 2), bi = by * W + bx;
            if (G[bi] != '.' || R[bi] || D[bi] < minLen || D[bi] > maxLen) continue;
            OUT[4 * got] = ax; OUT[4 * got + 1] = ay; OUT[4 * got + 2] = bx; OUT[4 * got + 3] = by;
            got++; break;
        }
    }
    return got;
}

}  // extern "C"
