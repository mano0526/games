// ===== 07_render.js : 3D描画（地形・空・雲・動く物・手に持つ物・粒） =====
let gl = null;
const R = {
  canvas: null, w: 1, h: 1, scale: 1,
  prog: {}, texArr: null, texMob: null, texCloud: null, quadIdx: null, maxQuads: 49152,
  proj: m4(), view: m4(), vp: m4(), invVP: m4(), tmpA: m4(), tmpB: m4(),
  planes: new Float32Array(24),
  sky: { zen: [0, 0, 0], hor: [0, 0, 0], fog: [0, 0, 0], light: [1, 1, 1], sun: [1, 0, 0], day: 1, night: 0 },
  fogStart: 60, fogEnd: 120, minLight: 0.045, time: 0,
  drawList: [], stats: { sections: 0, verts: 0 }, lost: false,
  clouds: true
};

const VS_TERRAIN = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in float a_layer; layout(location=2) in vec2 a_uv;
layout(location=3) in vec2 a_light; layout(location=4) in vec4 a_misc;
uniform mat4 u_vp; uniform vec3 u_off; uniform float u_time; uniform vec3 u_skyL; uniform vec3 u_camMod; uniform float u_minL; uniform vec3 u_tint[32];
out vec3 v_uvl; out vec3 v_light; out float v_dist;
void main(){
  vec3 p = a_pos / 16.0 + u_off;
  float fl = a_misc.y;
  if (mod(fl, 2.0) > 0.5) {
    vec3 w = p + u_camMod;
    p.x += sin(u_time * 1.8 + 6.2831853 * (w.x + w.z) / 8.0) * 0.07;
    p.z += cos(u_time * 1.4 + 6.2831853 * (w.x - w.z) / 8.0) * 0.07;
  }
  float layer = a_layer;
  if (a_misc.z > 0.5) { float sp = mod(floor(fl / 2.0), 2.0) > 0.5 ? 1.6 : 5.0; layer += mod(floor(u_time * sp), a_misc.z); }
  float s = a_light.x / 16.0, b = a_light.y / 16.0;
  vec3 skyC = u_skyL * pow(0.8, 15.0 - s);
  vec3 blkC = vec3(1.0, 0.87, 0.7) * pow(0.8, 15.0 - b);
  v_light = max(max(skyC, blkC), vec3(u_minL)) * (a_misc.x / 255.0) * u_tint[int(a_misc.w + 0.5)];
  v_uvl = vec3(a_uv / 16.0, layer);
  v_dist = length(p);
  gl_Position = u_vp * vec4(p, 1.0);
}`;
const FS_TERRAIN = (mode) => `#version 300 es
precision mediump float; precision mediump sampler2DArray;
uniform sampler2DArray u_tex; uniform vec3 u_fogColor; uniform vec2 u_fog;
in vec3 v_uvl; in vec3 v_light; in float v_dist; out vec4 o;
void main(){
  ${mode === 1 ? 'vec4 c = textureLod(u_tex, v_uvl, 0.0); if (c.a < 0.5) discard;' : 'vec4 c = texture(u_tex, v_uvl);'}
  float f = clamp((v_dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  o = vec4(mix(c.rgb * v_light, u_fogColor, f * f), ${mode === 2 ? 'c.a' : '1.0'});
}`;
const VS_DYN = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec2 a_uv; layout(location=2) in float a_layer; layout(location=3) in vec4 a_color;
uniform mat4 u_vp;
out vec2 v_uv; out float v_layer; out vec4 v_color; out float v_dist;
void main(){ v_uv = a_uv; v_layer = a_layer; v_color = a_color; v_dist = length(a_pos); gl_Position = u_vp * vec4(a_pos, 1.0); }`;
const FS_DYN = `#version 300 es
precision mediump float; precision mediump sampler2DArray;
uniform sampler2DArray u_tex; uniform sampler2D u_tex2; uniform int u_mode; uniform vec3 u_fogColor; uniform vec2 u_fog;
in vec2 v_uv; in float v_layer; in vec4 v_color; in float v_dist; out vec4 o;
void main(){
  vec4 c = v_color;
  if (u_mode == 1) c *= textureLod(u_tex, vec3(v_uv, v_layer), 0.0);
  else if (u_mode == 2) c *= texture(u_tex2, v_uv);
  if (c.a < 0.05) discard;
  float f = clamp((v_dist - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  o = vec4(mix(c.rgb, u_fogColor, f * f), c.a);
}`;
const VS_SKY = `#version 300 es
layout(location=0) in vec2 a_pos; out vec2 v_ndc;
void main(){ v_ndc = a_pos; gl_Position = vec4(a_pos, 0.9999, 1.0); }`;
const FS_SKY = `#version 300 es
precision highp float; precision mediump sampler2DArray;
uniform mat4 u_inv; uniform vec3 u_zen; uniform vec3 u_hor; uniform vec3 u_sun; uniform float u_night; uniform float u_time;
uniform sampler2DArray u_tex; uniform float u_sunL; uniform float u_moonL; uniform vec3 u_glow; uniform float u_under;
in vec2 v_ndc; out vec4 o;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec4 d = u_inv * vec4(v_ndc, 1.0, 1.0);
  vec3 dir = normalize(d.xyz / d.w);
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(u_hor, u_zen, pow(t, 0.55));
  if (dir.y < 0.0) col = mix(u_hor, u_hor * 0.72, clamp(-dir.y * 3.0, 0.0, 1.0));
  float sd = dot(dir, u_sun);
  col += u_glow * pow(max(sd, 0.0), 6.0) * (1.0 - t * 0.6);
  if (u_night > 0.02 && dir.y > 0.0) {
    vec3 q = floor(dir * 230.0);
    float h = hash(q);
    float tw = 0.75 + 0.25 * sin(u_time * 2.0 + h * 90.0);
    col += vec3(0.9, 0.93, 1.0) * step(0.9984, h) * u_night * tw * smoothstep(0.0, 0.25, dir.y);
  }
  vec3 rgt = normalize(cross(u_sun, vec3(0.0, 0.0, 1.0) + u_sun.yzx * 0.001));
  vec3 up2 = cross(rgt, u_sun);
  if (dir.y < -0.03) {
  } else if (sd > 0.5) {
    vec2 p = vec2(dot(dir, rgt), dot(dir, up2)) / sd / 0.16;
    if (abs(p.x) < 1.0 && abs(p.y) < 1.0) { vec4 s = textureLod(u_tex, vec3(p * 0.5 + 0.5, u_sunL), 0.0); col = mix(col, s.rgb, s.a); }
  } else if (sd < -0.5) {
    vec2 p = vec2(dot(dir, rgt), dot(dir, up2)) / -sd / 0.12;
    if (abs(p.x) < 1.0 && abs(p.y) < 1.0) { vec4 s = textureLod(u_tex, vec3(p * 0.5 + 0.5, u_moonL), 0.0); col = mix(col, s.rgb, s.a * 0.95); }
  }
  col = mix(col, u_hor, u_under);
  o = vec4(col, 1.0);
}`;
const VS_CLOUD = `#version 300 es
layout(location=0) in vec2 a_pos; uniform mat4 u_vp; uniform float u_y; uniform vec2 u_camXZ; uniform float u_time;
out vec2 v_uv; out vec2 v_xz;
void main(){
  vec3 p = vec3(a_pos.x * 700.0, u_y, a_pos.y * 700.0);
  v_uv = (p.xz + u_camXZ + vec2(u_time * 0.9, 0.0)) / (12.0 * 128.0);
  v_xz = p.xz;
  gl_Position = u_vp * vec4(p, 1.0);
}`;
const FS_CLOUD = `#version 300 es
precision highp float;
uniform sampler2D u_tex; uniform vec3 u_col; uniform vec3 u_fogColor;
in vec2 v_uv; in vec2 v_xz; out vec4 o;
void main(){
  float c = texture(u_tex, v_uv).r;
  if (c < 0.5) discard;
  float dist = length(v_xz);
  float a = 0.8 * (1.0 - smoothstep(380.0, 680.0, dist));
  o = vec4(mix(u_col, u_fogColor, smoothstep(250.0, 680.0, dist) * 0.7), a);
}`;

function compileProg(vs, fs, names) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('シェーダーの作成に失敗: ' + gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('シェーダーの結合に失敗: ' + gl.getProgramInfoLog(p));
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

// ---- 動く物用の頂点バッファ（位置3・UV2・層1・色4） ----
class DynBuf {
  constructor(cap) { this.cap = cap; this.f = new Float32Array(cap * 10); this.n = 0; this.vbo = null; this.vao = null; }
  ensure(k) { if (this.n + k > this.cap) { this.cap = Math.max(this.cap * 2, this.n + k); const f = new Float32Array(this.cap * 10); f.set(this.f.subarray(0, this.n * 10)); this.f = f; } }
  v(x, y, z, u, vv, layer, r, g, b, a) {
    if (this.n >= this.cap) this.ensure(64);
    const f = this.f, o = this.n * 10;
    f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = u; f[o + 4] = vv; f[o + 5] = layer; f[o + 6] = r; f[o + 7] = g; f[o + 8] = b; f[o + 9] = a;
    this.n++;
  }
  gpu() {
    if (!this.vao) {
      this.vao = gl.createVertexArray(); this.vbo = gl.createBuffer();
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 40, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 40, 20);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 40, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx);
    } else { gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); }
    gl.bufferData(gl.ARRAY_BUFFER, this.f.subarray(0, this.n * 10), gl.DYNAMIC_DRAW);
  }
  drawQuads() { if (!this.n) return; this.gpu(); gl.drawElements(gl.TRIANGLES, Math.min(this.n >> 2, R.maxQuads) * 6, gl.UNSIGNED_INT, 0); }
  drawLines() { if (!this.n) return; this.gpu(); gl.drawArrays(gl.LINES, 0, this.n); }
  reset() { this.n = 0; }
}
const dynTex = new DynBuf(4096), dynEnt = new DynBuf(8192), dynCol = new DynBuf(8192), dynLine = new DynBuf(256),
  dynCrack = new DynBuf(64), dynGlow = new DynBuf(1024), handTex = new DynBuf(64), handCol = new DynBuf(4096);

function initRenderer(canvas) {
  R.canvas = canvas;
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.lost = true; if (typeof onContextLost === 'function') onContextLost(); });
  const tU = ['u_vp', 'u_off', 'u_time', 'u_skyL', 'u_camMod', 'u_minL', 'u_tex', 'u_fogColor', 'u_fog', 'u_tint'];
  R.prog.opaque = compileProg(VS_TERRAIN, FS_TERRAIN(0), tU);
  R.prog.cutout = compileProg(VS_TERRAIN, FS_TERRAIN(1), tU);
  R.prog.trans = compileProg(VS_TERRAIN, FS_TERRAIN(2), tU);
  R.prog.dyn = compileProg(VS_DYN, FS_DYN, ['u_vp', 'u_tex', 'u_tex2', 'u_mode', 'u_fogColor', 'u_fog']);
  R.prog.sky = compileProg(VS_SKY, FS_SKY, ['u_inv', 'u_zen', 'u_hor', 'u_sun', 'u_night', 'u_time', 'u_tex', 'u_sunL', 'u_moonL', 'u_glow', 'u_under']);
  R.prog.cloud = compileProg(VS_CLOUD, FS_CLOUD, ['u_vp', 'u_y', 'u_camXZ', 'u_time', 'u_tex', 'u_col', 'u_fogColor']);
  // 四角形用の共通インデックス
  const idx = new Uint32Array(R.maxQuads * 6);
  for (let q = 0; q < R.maxQuads; q++) { const o = q * 6, v = q * 4; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
  R.quadIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  // ブロックの絵（層になった画像）
  R.texArr = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.texArr);
  uploadBlockTextures();
  // 画面全体を覆う三角形・雲の板
  R.fsVao = gl.createVertexArray(); gl.bindVertexArray(R.fsVao);
  const fb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.cloudVao = gl.createVertexArray(); gl.bindVertexArray(R.cloudVao);
  const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  // 雲の模様
  const cd = new Uint8Array(128 * 128), rr = mulberry32(20261118);
  let g = new Uint8Array(128 * 128);
  for (let i = 0; i < g.length; i++) g[i] = rr() < 0.46 ? 1 : 0;
  for (let it = 0; it < 3; it++) {
    const n = new Uint8Array(128 * 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) s += g[((y + dy) & 127) * 128 + ((x + dx) & 127)];
      n[y * 128 + x] = s >= 8 ? 1 : 0;
    }
    g = n;
  }
  for (let i = 0; i < g.length; i++) cd[i] = g[i] ? 255 : 0;
  R.texCloud = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, R.texCloud);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 128, 128, 0, gl.RED, gl.UNSIGNED_BYTE, cd);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  return true;
}
function uploadBlockTextures() {
  const n = TEX_DATA.length, all = new Uint8Array(n * 1024);
  for (let i = 0; i < n; i++) all.set(TEX_DATA[i], i * 1024);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.texArr);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, all);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 3);
}
function uploadMobTexture(canvas) {
  R.texMob = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, R.texMob);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
function resizeRenderer() {
  const c = R.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2) * R.scale;
  const w = Math.max(2, Math.round(c.clientWidth * dpr)), h = Math.max(2, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  R.w = w; R.h = h;
}

// ---- 区画の面データを画面用メモリへ ----
function uploadSection(c, sy, m) {
  let s = c.meshes[sy];
  if (!m) { if (s) { gl.deleteBuffer(s.vbo); gl.deleteVertexArray(s.vao); c.meshes[sy] = null; } return; }
  if (!s) {
    s = c.meshes[sy] = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), nO: 0, nC: 0, nD: 0, nT: 0 };
    gl.bindVertexArray(s.vao); gl.bindBuffer(gl.ARRAY_BUFFER, s.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.UNSIGNED_SHORT, false, 16, 6);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.UNSIGNED_BYTE, false, 16, 8);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.UNSIGNED_BYTE, false, 16, 10);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, false, 16, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx);
  } else { gl.bindVertexArray(s.vao); gl.bindBuffer(gl.ARRAY_BUFFER, s.vbo); }
  gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
  s.nO = m.nO; s.nC = m.nC; s.nD = m.nD || 0; s.nT = m.nT;
  gl.bindVertexArray(null);
}
function freeChunkMeshes(c) {
  if (!gl) return;
  for (let i = 0; i < NSEC; i++) { const s = c.meshes[i]; if (s) { gl.deleteBuffer(s.vbo); gl.deleteVertexArray(s.vao); c.meshes[i] = null; } }
}
// 毎フレーム：書きかわった区画を作り直す
function updateMeshes(world, px, py, pz, viewR, budgetMs) {
  const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16), psy = clamp(Math.floor(py / 16), 0, NSEC - 1);
  const t0 = performance.now();
  if (world.urgent) {
    world.urgent = false;
    let done = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = world.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.dirty || !c.meshed || !world.canMesh(c)) continue;
      for (let s = 0; s < NSEC && done < 14; s++) if (c.dirty & (1 << s)) { c.dirty &= ~(1 << s); uploadSection(c, s, meshSection(world, c, s)); done++; }
    }
  }
  const order = spiralOrder(viewR);
  for (let n = 0; n < order.length; n += 2) {
    const c = world.getChunk(pcx + order[n], pcz + order[n + 1]);
    if (!c || !c.dirty || !world.canMesh(c)) continue;
    // プレイヤーに近い高さから順に
    for (let k = 0; k < NSEC; k++) {
      const s = k === 0 ? psy : (k <= psy ? psy - k : k);
      if (!(c.dirty & (1 << s))) continue;
      c.dirty &= ~(1 << s);
      uploadSection(c, s, meshSection(world, c, s));
      if (performance.now() - t0 > budgetMs) { if (!c.dirty) c.meshed = true; return false; }
    }
    c.meshed = true;
  }
  return true;
}

// ---- 見えない区画をはぶく ----
// カメラのいる区画から、となりの区画へ「つうじている面」をたどっていく。たどり着けない区画（かべの向こうの洞くつ、地上から見えない地下など）は描かない。
// たどるのは カメラから遠ざかる向きだけ（まっすぐな視線は 行ったり来たりしない）。カメラの向きには関係しないので、カメラが同じ区画にいる間は 結果を使い回す。
const CULL = { on: true, key: '', seen: new Uint8Array(0), q: new Int32Array(0), W: 0, ok: false, n: 0 };
function cullUpdate(world, cam, viewR) {
  const pcx = Math.floor(cam.x / 16), pcz = Math.floor(cam.z / 16), ps = Math.floor(cam.y / 16);
  if (!CULL.on || ps < 0 || ps >= NSEC) { CULL.ok = false; return; }
  const key = pcx + ',' + ps + ',' + pcz + ',' + viewR + ',' + VIS_VER + ',' + world.token + ',' + world.chunks.size;
  if (key === CULL.key) { CULL.ok = true; return; }
  CULL.key = key;
  const W = viewR * 2 + 1, N = W * W * NSEC;
  if (CULL.seen.length < N) { CULL.seen = new Uint8Array(N); CULL.q = new Int32Array(N * 7 + 8); }
  const seen = CULL.seen, q = CULL.q; seen.fill(0, 0, N); CULL.W = W;
  let qh = 0, qt = 0;
  const start = (viewR * W + viewR) * NSEC + ps;
  seen[start] = 64; q[qt++] = start * 8 + 6;
  while (qh < qt) {
    const v = q[qh++], from = v & 7, idx = v >> 3, s = idx % NSEC, col = (idx - s) / NSEC, ix = col % W, iz = (col - ix) / W;
    const c = world.getChunk(pcx + ix - viewR, pcz + iz - viewR);
    const cv = c && c.stage >= 2 ? c.vis : null, conn = from < 6 && cv ? cv[s * 6 + from] : 63;
    for (let f = 0; f < 6; f++) {
      if (!(conn & (1 << f))) continue;
      let nx = ix, ns = s, nz = iz;
      if (f === 0) { if (ix < viewR) continue; nx++; } else if (f === 1) { if (ix > viewR) continue; nx--; }
      else if (f === 2) { if (s < ps) continue; ns++; } else if (f === 3) { if (s > ps) continue; ns--; }
      else if (f === 4) { if (iz < viewR) continue; nz++; } else { if (iz > viewR) continue; nz--; }
      if (nx < 0 || nx >= W || nz < 0 || nz >= W || ns < 0 || ns >= NSEC) continue;
      const ni = (nz * W + nx) * NSEC + ns, bit = 1 << (f ^ 1);
      if (seen[ni] & bit) continue;
      seen[ni] |= bit; q[qt++] = ni * 8 + (f ^ 1);
    }
  }
  CULL.ok = true;
}
function extractPlanes(m, out) {
  const set = (i, a, b, c, d) => { const l = Math.hypot(a, b, c) || 1; out[i * 4] = a / l; out[i * 4 + 1] = b / l; out[i * 4 + 2] = c / l; out[i * 4 + 3] = d / l; };
  set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
  set(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
  set(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
  set(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
  set(4, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
  set(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
}
function boxVisible(pl, x0, y0, z0, x1, y1, z1) {
  for (let i = 0; i < 6; i++) {
    const a = pl[i * 4], b = pl[i * 4 + 1], c = pl[i * 4 + 2];
    if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + pl[i * 4 + 3] < 0) return false;
  }
  return true;
}

function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function updateSky(world) {
  const sk0 = R.sky, mb = Math.max(R.minBase === undefined ? 0.045 : R.minBase, player.fx.night > 0 ? 0.55 * Math.min(1, player.fx.night / 60) : 0); R.minLight = mb;   // 「よめの くすり」の間は 暗い所も明るい R.dim = world.dim | 0;
  if (world.dim === 1) {   // ホムラの底：空はなく、赤黒いもや
    sk0.day = 0; sk0.night = 0; sk0.zen = sk0.hor = sk0.fog = [0.27, 0.065, 0.04]; sk0.light = [0.3, 0.3, 0.3]; sk0.sun = [0, -1, 0]; sk0.glow = [0, 0, 0]; R.minLight = mb + 0.27; return;
  }
  if (world.dim === 2) {   // ソラのはて：ずっと夜の空。うすむらさきの明かり
    sk0.day = 0; sk0.night = 1; sk0.zen = [0.025, 0.012, 0.06]; sk0.hor = sk0.fog = [0.085, 0.05, 0.15]; sk0.light = [0.6, 0.55, 0.78]; sk0.sun = [0.35, -0.8, 0.48]; sk0.glow = [0, 0, 0]; R.minLight = mb + 0.07; return;
  }
  const ang = world.time / 24000 * Math.PI * 2, s = Math.sin(ang), day = world.dayFactor();
  const dusk = Math.max(0, 1 - Math.abs(s) / 0.32);
  const sk = R.sky;
  sk.day = day; sk.night = 1 - smoothstep(-0.3, 0.05, s);
  let zen = lerp3([0.012, 0.018, 0.055], [0.30, 0.55, 0.96], day);
  let hor = lerp3([0.045, 0.065, 0.15], [0.66, 0.83, 1.0], day);
  hor = lerp3(hor, [0.98, 0.56, 0.3], dusk * 0.55);
  zen = lerp3(zen, [0.3, 0.28, 0.5], dusk * 0.3);
  sk.zen = zen; sk.hor = hor; sk.fog = hor;
  let light = lerp3([0.2, 0.25, 0.42], [1, 1, 1], day);
  light = lerp3(light, [1.0, 0.8, 0.62], dusk * 0.35 * day);
  sk.light = light;
  const l = Math.hypot(Math.cos(ang), s, 0.18);
  sk.sun = [Math.cos(ang) / l, s / l, 0.18 / l];
  sk.glow = [1.0 * dusk * 0.6, 0.5 * dusk * 0.6, 0.2 * dusk * 0.6];
}
// 動く物に当たる光の色（地形のシェーダーと同じ計算）
function lightRGB(raw, out) {
  const s = raw >> 4, b = raw & 15, sl = R.sky.light, sb = Math.pow(0.8, 15 - s), bb = Math.pow(0.8, 15 - b);
  out[0] = Math.max(sl[0] * sb, bb, R.minLight); out[1] = Math.max(sl[1] * sb, bb * 0.87, R.minLight); out[2] = Math.max(sl[2] * sb, bb * 0.7, R.minLight);
  return out;
}

function setCamera(cam) {
  let fv = cam.fov * Math.PI / 180; const asp = R.w / R.h;
  if (asp < 1) fv = Math.min(1.75, Math.max(fv, 2 * Math.atan(Math.tan(0.52) / asp)));   // 縦長の画面では左右がせまくなりすぎないようにする
  m4Perspective(R.proj, fv, asp, 0.06, 900);
  m4RotX(R.tmpA, -cam.pitch); m4RotY(R.tmpB, -cam.yaw);
  m4Mul(R.view, R.tmpA, R.tmpB);
  if (cam.roll) { m4RotZ(R.tmpA, cam.roll); m4Mul(R.view, R.tmpA, R.view); }
  m4Mul(R.vp, R.proj, R.view);
  m4Invert(R.invVP, R.vp);
  extractPlanes(R.vp, R.planes);
}
function terrainUniforms(pr, cam) {
  gl.useProgram(pr.p);
  gl.uniformMatrix4fv(pr.u.u_vp, false, R.vp);
  gl.uniform1f(pr.u.u_time, R.time);
  gl.uniform3fv(pr.u.u_skyL, R.sky.light);
  gl.uniform3f(pr.u.u_camMod, ((cam.x % 64) + 64) % 64, 0, ((cam.z % 64) + 64) % 64);
  gl.uniform1f(pr.u.u_minL, R.minLight);
  if (!R.tintArr) { R.tintArr = new Float32Array(96).fill(1); TINT_RGB.forEach((c, i) => { R.tintArr[i * 3] = c[0]; R.tintArr[i * 3 + 1] = c[1]; R.tintArr[i * 3 + 2] = c[2]; }); }
  gl.uniform3fv(pr.u.u_tint, R.tintArr);
  gl.uniform3fv(pr.u.u_fogColor, R.fogColor);
  gl.uniform2f(pr.u.u_fog, R.fogStart, R.fogEnd);
  gl.uniform1i(pr.u.u_tex, 0);
}
function dynUniforms(vp, mode, fog) {
  const pr = R.prog.dyn;
  gl.useProgram(pr.p);
  gl.uniformMatrix4fv(pr.u.u_vp, false, vp);
  gl.uniform1i(pr.u.u_tex, 0); gl.uniform1i(pr.u.u_tex2, 1); gl.uniform1i(pr.u.u_mode, mode);
  gl.uniform3fv(pr.u.u_fogColor, R.fogColor);
  if (fog) gl.uniform2f(pr.u.u_fog, R.fogStart, R.fogEnd); else gl.uniform2f(pr.u.u_fog, 1e6, 2e6);
}

// world: 世界, cam: {x,y,z,yaw,pitch,fov,roll}, viewR: 見える距離, under: 0=空気 1=水中 2=溶岩の中
function renderFrame(world, cam, viewR, under, drawHand) {
  if (R.lost) return;
  if (R.skip) {   // テスト用：絵を描かずに、計算だけ進める
    setCamera(cam);
    dynTex.n = dynEnt.n = dynCol.n = dynLine.n = dynCrack.n = dynGlow.n = handTex.n = handCol.n = 0;
    return;
  }
  resizeRenderer();
  gl.viewport(0, 0, R.w, R.h);
  updateSky(world);
  setCamera(cam);
  const sk = R.sky;
  R.fogColor = under === 1 ? [0.08, 0.2, 0.45].map((v, i) => v * (0.3 + 0.7 * sk.day)) : under === 2 ? [0.9, 0.35, 0.05] : sk.fog;
  const far = viewR * 16;
  R.fogStart = under === 1 ? 2 : under === 2 ? 0.2 : far * 0.62; R.fogEnd = under === 1 ? 30 : under === 2 ? 2.5 : far - 6;
  if (R.dim === 1 && !under) { R.fogStart = Math.min(R.fogStart, 14); R.fogEnd = Math.min(R.fogEnd, 86); }
  gl.clearColor(R.fogColor[0], R.fogColor[1], R.fogColor[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.texMob);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.texArr);
  // 空
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  const ps = R.prog.sky;
  gl.useProgram(ps.p);
  gl.uniformMatrix4fv(ps.u.u_inv, false, R.invVP);
  gl.uniform3fv(ps.u.u_zen, sk.zen); gl.uniform3fv(ps.u.u_hor, sk.hor); gl.uniform3fv(ps.u.u_sun, sk.sun);
  gl.uniform1f(ps.u.u_night, sk.night); gl.uniform1f(ps.u.u_time, R.time); gl.uniform1i(ps.u.u_tex, 0);
  gl.uniform1f(ps.u.u_sunL, TEX.sun); gl.uniform1f(ps.u.u_moonL, TEX.moon); gl.uniform3fv(ps.u.u_glow, sk.glow);
  gl.uniform1f(ps.u.u_under, under || R.dim === 1 ? 1 : 0);
  if (under) gl.uniform3fv(ps.u.u_hor, R.fogColor);
  gl.bindVertexArray(R.fsVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  // 見える区画を集める
  const list = R.drawList; let ln = 0;
  const pcx = Math.floor(cam.x / 16), pcz = Math.floor(cam.z / 16), pl = R.planes;
  cullUpdate(world, cam, viewR);
  const cOk = CULL.ok, cSeen = CULL.seen, cW = CULL.W; let hidden = 0;
  for (const c of world.chunks.values()) {
    const dx = c.cx - pcx, dz = c.cz - pcz;
    if (dx > viewR || dx < -viewR || dz > viewR || dz < -viewR) continue;
    const cBase = cOk ? ((dz + viewR) * cW + dx + viewR) * NSEC : 0;
    const ox = c.cx * 16 - cam.x, oz = c.cz * 16 - cam.z;
    if (!boxVisible(pl, ox, -cam.y, oz, ox + 16, CH - cam.y, oz + 16)) continue;
    for (let s = 0; s < NSEC; s++) {
      const m = c.meshes[s];
      if (!m) continue;
      if (cOk && !cSeen[cBase + s]) { hidden++; continue; }   // かべの向こうで 見えない
      const oy = s * 16 - cam.y;
      if (!boxVisible(pl, ox, oy, oz, ox + 16, oy + 16, oz + 16)) continue;
      const cx2 = ox + 8, cy2 = oy + 8, cz2 = oz + 8;
      let e = list[ln]; if (!e) e = list[ln] = { m: null, ox: 0, oy: 0, oz: 0, d: 0 };   // 入れ物は使い回す（毎コマ 作り直さない）
      e.m = m; e.ox = ox; e.oy = oy; e.oz = oz; e.d = cx2 * cx2 + cy2 * cy2 + cz2 * cz2; ln++;
    }
  }
  list.length = ln;
  list.sort((a, b) => a.d - b.d);
  R.stats.sections = list.length; R.stats.hidden = hidden;
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  // 不透明
  let pr = R.prog.opaque; terrainUniforms(pr, cam);
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (!e.m.nO) continue;
    gl.uniform3f(pr.u.u_off, e.ox, e.oy, e.oz); gl.bindVertexArray(e.m.vao);
    gl.drawElements(gl.TRIANGLES, (e.m.nO >> 2) * 6, gl.UNSIGNED_INT, 0);
  }
  // 切り抜き（葉・草花・ガラスなど）
  pr = R.prog.cutout; terrainUniforms(pr, cam);
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (!e.m.nC) continue;
    gl.uniform3f(pr.u.u_off, e.ox, e.oy, e.oz); gl.bindVertexArray(e.m.vao);
    gl.drawElements(gl.TRIANGLES, (e.m.nC >> 2) * 6, gl.UNSIGNED_INT, (e.m.nO >> 2) * 24);
  }
  // 切り抜きのうち、両面から見える分（葉と葉のさかい目）
  gl.disable(gl.CULL_FACE);
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (!e.m.nD) continue;
    gl.uniform3f(pr.u.u_off, e.ox, e.oy, e.oz); gl.bindVertexArray(e.m.vao);
    gl.drawElements(gl.TRIANGLES, (e.m.nD >> 2) * 6, gl.UNSIGNED_INT, ((e.m.nO + e.m.nC) >> 2) * 24);
  }
  // 動く物
  dynUniforms(R.vp, 2, true); dynEnt.drawQuads();
  dynUniforms(R.vp, 1, true); dynTex.drawQuads();
  dynUniforms(R.vp, 0, true); dynCol.drawQuads();
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (dynCrack.n) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2); dynUniforms(R.vp, 1, true); dynCrack.drawQuads(); gl.disable(gl.POLYGON_OFFSET_FILL); }
  if (dynLine.n) { dynUniforms(R.vp, 0, false); dynLine.drawLines(); }
  // 雲
  if (R.clouds && !under && !R.dim) {
    const pc = R.prog.cloud;
    gl.useProgram(pc.p); gl.depthMask(false);
    gl.uniformMatrix4fv(pc.u.u_vp, false, R.vp); gl.uniform1f(pc.u.u_y, 132.5 - cam.y);
    gl.uniform2f(pc.u.u_camXZ, cam.x % 1536, cam.z % 1536); gl.uniform1f(pc.u.u_time, R.time);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.texCloud); gl.uniform1i(pc.u.u_tex, 2);
    const cc = 0.25 + 0.75 * sk.day;
    gl.uniform3f(pc.u.u_col, cc * (0.9 + 0.1 * sk.light[0]), cc * (0.9 + 0.1 * sk.light[1]), cc); gl.uniform3fv(pc.u.u_fogColor, sk.hor);
    gl.bindVertexArray(R.cloudVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.activeTexture(gl.TEXTURE0); gl.depthMask(true);
  }
  // 半透明（水・氷）を遠くから
  gl.enable(gl.CULL_FACE);
  pr = R.prog.trans; terrainUniforms(pr, cam);
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]; if (!e.m.nT) continue;
    gl.uniform3f(pr.u.u_off, e.ox, e.oy, e.oz); gl.bindVertexArray(e.m.vao);
    gl.drawElements(gl.TRIANGLES, (e.m.nT >> 2) * 6, gl.UNSIGNED_INT, ((e.m.nO + e.m.nC + e.m.nD) >> 2) * 24);
  }
  // 光る粒（加算）
  gl.disable(gl.CULL_FACE);
  if (dynGlow.n) { gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); dynUniforms(R.vp, 0, true); dynGlow.drawQuads(); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true); }
  gl.disable(gl.BLEND);
  // 手に持っている物
  if (drawHand && (handTex.n || handCol.n)) {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    m4Perspective(R.tmpA, 70 * Math.PI / 180, R.w / R.h, 0.05, 20);
    dynUniforms(R.tmpA, 1, false); handTex.drawQuads();
    dynUniforms(R.tmpA, 0, false); handCol.drawQuads();
  }
  gl.bindVertexArray(null);
  dynTex.reset(); dynEnt.reset(); dynCol.reset(); dynLine.reset(); dynCrack.reset(); dynGlow.reset(); handTex.reset(); handCol.reset();
}

// ---- 形を追加する道具 ----
const _v3 = new Float32Array(3);
// 行列 m で変換した立方体ブロック（層つきの絵）。size=1 で中心が原点
const _bp = new Float32Array(12), _buv = new Float32Array(8);
// 行列 m で変換した箱（1/16マス単位の q=[x0,y0,z0,x1,y1,z1]）。絵は場所に合わせて切り出す（地形と同じ貼り方）
function addBoxPart(buf, m, q, tl, r, g, b, a) {
  const x0 = q[0], y0 = q[1], z0 = q[2], x1 = q[3], y1 = q[4], z1 = q[5], p = _bp, uv = _buv;
  for (let f = 0; f < 6; f++) {
    switch (f) {
      case 0: p[0] = x1; p[1] = y0; p[2] = z1; p[3] = x1; p[4] = y0; p[5] = z0; p[6] = x1; p[7] = y1; p[8] = z0; p[9] = x1; p[10] = y1; p[11] = z1;
        uv[0] = 16 - z1; uv[1] = 16 - y0; uv[2] = 16 - z0; uv[3] = 16 - y0; uv[4] = 16 - z0; uv[5] = 16 - y1; uv[6] = 16 - z1; uv[7] = 16 - y1; break;
      case 1: p[0] = x0; p[1] = y0; p[2] = z0; p[3] = x0; p[4] = y0; p[5] = z1; p[6] = x0; p[7] = y1; p[8] = z1; p[9] = x0; p[10] = y1; p[11] = z0;
        uv[0] = z0; uv[1] = 16 - y0; uv[2] = z1; uv[3] = 16 - y0; uv[4] = z1; uv[5] = 16 - y1; uv[6] = z0; uv[7] = 16 - y1; break;
      case 2: p[0] = x0; p[1] = y1; p[2] = z1; p[3] = x1; p[4] = y1; p[5] = z1; p[6] = x1; p[7] = y1; p[8] = z0; p[9] = x0; p[10] = y1; p[11] = z0;
        for (let k = 0; k < 4; k++) { uv[k * 2] = p[k * 3]; uv[k * 2 + 1] = p[k * 3 + 2]; } break;
      case 3: p[0] = x0; p[1] = y0; p[2] = z0; p[3] = x1; p[4] = y0; p[5] = z0; p[6] = x1; p[7] = y0; p[8] = z1; p[9] = x0; p[10] = y0; p[11] = z1;
        uv[0] = x0; uv[1] = 16 - z0; uv[2] = x1; uv[3] = 16 - z0; uv[4] = x1; uv[5] = 16 - z1; uv[6] = x0; uv[7] = 16 - z1; break;
      case 4: p[0] = x0; p[1] = y0; p[2] = z1; p[3] = x1; p[4] = y0; p[5] = z1; p[6] = x1; p[7] = y1; p[8] = z1; p[9] = x0; p[10] = y1; p[11] = z1;
        uv[0] = x0; uv[1] = 16 - y0; uv[2] = x1; uv[3] = 16 - y0; uv[4] = x1; uv[5] = 16 - y1; uv[6] = x0; uv[7] = 16 - y1; break;
      default: p[0] = x1; p[1] = y0; p[2] = z0; p[3] = x0; p[4] = y0; p[5] = z0; p[6] = x0; p[7] = y1; p[8] = z0; p[9] = x1; p[10] = y1; p[11] = z0;
        uv[0] = 16 - x1; uv[1] = 16 - y0; uv[2] = 16 - x0; uv[3] = 16 - y0; uv[4] = 16 - x0; uv[5] = 16 - y1; uv[6] = 16 - x1; uv[7] = 16 - y1;
    }
    const sh = FACE_SHADE[f];
    for (let k = 0; k < 4; k++) { m4Point(_v3, m, p[k * 3] / 16 - 0.5, p[k * 3 + 1] / 16 - 0.5, p[k * 3 + 2] / 16 - 0.5); buf.v(_v3[0], _v3[1], _v3[2], uv[k * 2] / 16, uv[k * 2 + 1] / 16, tl[f], r * sh, g * sh, b * sh, a); }
  }
}
function addBlockCube(buf, m, id, r, g, b, a, meta) {
  const bl = BLOCKS[id]; if (!bl || !bl.tl) return;
  const tl = bl.tl;
  if (TINT[id]) { const c = TINT_RGB[TINT[id]]; r *= c[0]; g *= c[1]; b *= c[2]; }
  const parts = itemParts(id);
  if (parts) { for (const q of parts) addBoxPart(buf, m, q, tl, r, g, b, a); return; }
  for (let f = 0; f < 6; f++) {
    const sh = FACE_SHADE[f];
    for (let k = 0; k < 4; k++) {
      const t = (f * 4 + k) * 3;
      m4Point(_v3, m, CPOS[t] - 0.5, CPOS[t + 1] - 0.5, CPOS[t + 2] - 0.5);
      buf.v(_v3[0], _v3[1], _v3[2], CORNER_UV[k][0], 1 - CORNER_UV[k][1], id === 2 && f === 2 ? TEX.grass_top_0 : (id === 2 && f !== 3 ? TEX.grass_side_0 : tl[f]), r * sh, g * sh, b * sh, a);
    }
  }
}
// 層つきの箱（ひび割れ表示用）: ワールド座標の箱（カメラ相対）
function addLayerBox(buf, x0, y0, z0, x1, y1, z1, layer, r, g, b, a) {
  const P = [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0],
    [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) buf.v(P[f][k * 3], P[f][k * 3 + 1], P[f][k * 3 + 2], CORNER_UV[k][0], 1 - CORNER_UV[k][1], layer, r, g, b, a);
}
function addBoxLines(buf, x0, y0, z0, x1, y1, z1, r, g, b, a) {
  const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  for (let i = 0; i < 24; i++) { const p = c[e[i]]; buf.v(p[0], p[1], p[2], 0, 0, 0, r, g, b, a); }
}
// 単色の箱を行列つきで（腕など）
function addColorBox(buf, m, x0, y0, z0, x1, y1, z1, r, g, b, a) {
  const P = [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0],
    [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0]];
  for (let f = 0; f < 6; f++) { const sh = FACE_SHADE[f]; for (let k = 0; k < 4; k++) { m4Point(_v3, m, P[f][k * 3], P[f][k * 3 + 1], P[f][k * 3 + 2]); buf.v(_v3[0], _v3[1], _v3[2], 0, 0, 0, r * sh, g * sh, b * sh, a); } }
}

// ---- ドット絵を厚みのある板にする（持ち物・落ちているアイテム） ----
const _itemMeshCache = {};
function itemMesh(id) {
  if (_itemMeshCache[id]) return _itemMeshCache[id];
  const d = ICON[id]; if (!d) return null;
  const out = [], T = 1 / 32;
  const A = (x, y) => (x < 0 || x > 15 || y < 0 || y > 15) ? 0 : d[(y * 16 + x) * 4 + 3];
  const q = (p, c, sh) => { for (let k = 0; k < 4; k++) out.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2], c[0] / 255 * sh, c[1] / 255 * sh, c[2] / 255 * sh); };
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      if (A(x, y) < 128) { x++; continue; }
      const i = (y * 16 + x) * 4, c = [d[i], d[i + 1], d[i + 2]];
      let x2 = x + 1;
      while (x2 < 16 && A(x2, y) >= 128 && d[(y * 16 + x2) * 4] === c[0] && d[(y * 16 + x2) * 4 + 1] === c[1] && d[(y * 16 + x2) * 4 + 2] === c[2]) x2++;
      const xa = x / 16 - 0.5, xb = x2 / 16 - 0.5, ya = 0.5 - (y + 1) / 16, yb = 0.5 - y / 16;
      q([xa, ya, T, xb, ya, T, xb, yb, T, xa, yb, T], c, 1);
      q([xb, ya, -T, xa, ya, -T, xa, yb, -T, xb, yb, -T], c, 0.8);
      x = x2;
    }
    for (x = 0; x < 16; x++) {
      if (A(x, y) < 128) continue;
      const i = (y * 16 + x) * 4, c = [d[i], d[i + 1], d[i + 2]];
      const xa = x / 16 - 0.5, xb = (x + 1) / 16 - 0.5, ya = 0.5 - (y + 1) / 16, yb = 0.5 - y / 16;
      if (A(x - 1, y) < 128) q([xa, ya, -T, xa, ya, T, xa, yb, T, xa, yb, -T], c, 0.7);
      if (A(x + 1, y) < 128) q([xb, ya, T, xb, ya, -T, xb, yb, -T, xb, yb, T], c, 0.7);
      if (A(x, y - 1) < 128) q([xa, yb, T, xb, yb, T, xb, yb, -T, xa, yb, -T], c, 0.9);
      if (A(x, y + 1) < 128) q([xa, ya, -T, xb, ya, -T, xb, ya, T, xa, ya, T], c, 0.6);
    }
  }
  return (_itemMeshCache[id] = new Float32Array(out));
}
function addItemMesh(buf, m, id, r, g, b, a) {
  const ms = itemMesh(id); if (!ms) return;
  buf.ensure(ms.length / 6);
  for (let i = 0; i < ms.length; i += 6) { m4Point(_v3, m, ms[i], ms[i + 1], ms[i + 2]); buf.v(_v3[0], _v3[1], _v3[2], 0, 0, 0, ms[i + 3] * r, ms[i + 4] * g, ms[i + 5] * b, a); }
}
// アイテム（ブロックなら立方体、それ以外は板）を行列つきで追加
function addItemModel(texBuf, colBuf, m, id, r, g, b) {
  if (isBlk(id) && !ICON[id]) addBlockCube(texBuf, m, id, r, g, b, 1);
  else addItemMesh(colBuf, m, id, r, g, b, 1);
}

// 手での持ち方：0＝ブロック（立方体や形のまま）、2＝柄をにぎる道具（絵は 左下が柄・右上が先。ツルハシ・剣・弓・棒・矢など）、1＝そのほかの平たい物（下を持って たてる）
const _holdKind = {};
function holdKind(id) {
  let k = _holdKind[id]; if (k !== undefined) return k;
  if (isBlk(id) && !ICON[id]) k = 0;
  else { const d = ITEMS[id], t = d && d.tool ? d.tool.type : ''; k = (t && t !== 'lighter' && t !== 'shears') || id === I.stick || id === I.arrow || id === I.bow_p1 || id === I.bow_p2 ? 2 : 1; }
  return (_holdKind[id] = k);
}

// ---- 粒（こわれたかけら・けむり・きらめき） ----
const PT = { n: 0, max: 1400, x: new Float32Array(1400), y: new Float32Array(1400), z: new Float32Array(1400), vx: new Float32Array(1400), vy: new Float32Array(1400), vz: new Float32Array(1400),
  life: new Float32Array(1400), max0: new Float32Array(1400), size: new Float32Array(1400), layer: new Float32Array(1400), u: new Float32Array(1400), v: new Float32Array(1400),
  r: new Float32Array(1400), g: new Float32Array(1400), b: new Float32Array(1400), grav: new Float32Array(1400), kind: new Uint8Array(1400) };
function addParticle(kind, x, y, z, vx, vy, vz, life, size, grav, layer, u, v, r, g, b) {
  let i = PT.n;
  if (i >= PT.max) i = (Math.random() * PT.max) | 0; else PT.n++;
  PT.kind[i] = kind; PT.x[i] = x; PT.y[i] = y; PT.z[i] = z; PT.vx[i] = vx; PT.vy[i] = vy; PT.vz[i] = vz; PT.life[i] = PT.max0[i] = life; PT.size[i] = size; PT.grav[i] = grav;
  PT.layer[i] = layer; PT.u[i] = u; PT.v[i] = v; PT.r[i] = r; PT.g[i] = g; PT.b[i] = b;
}
// kind 0: ブロックのかけら（絵つき） 1: 単色 2: 光る
function fxAmount(n) { const k = settings.particles === 2 ? 1 : settings.particles === 1 ? 0.6 : 0.3; return k === 1 ? n : Math.max(1, Math.round(n * k)); }
function fxBlockBits(x, y, z, id, n, spread) {
  const bl = BLOCKS[id]; if (!bl || !bl.tl) return;
  const tc = TINT_RGB[TINT[id]];   // 色つきのブロックは かけらにも色をかける
  n = fxAmount(n);
  for (let i = 0; i < n; i++) {
    const layer = id === 2 ? (Math.random() < 0.4 ? TEX.grass_top_0 : TEX.dirt) : bl.tl[(Math.random() * 6) | 0];
    addParticle(0, x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 3, Math.random() * 3.5 + 0.5, (Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.6, 0.07 + Math.random() * 0.06, 16,
      layer, Math.floor(Math.random() * 13) / 16, Math.floor(Math.random() * 13) / 16, tc[0], tc[1], tc[2]);
  }
}
function fxPuff(x, y, z, n, r, g, b, opts) {
  const o = opts || {};
  n = fxAmount(n);
  for (let i = 0; i < n; i++) addParticle(o.glow ? 2 : 1, x + (Math.random() - 0.5) * (o.spread || 0.4), y + (Math.random() - 0.5) * (o.spread || 0.4), z + (Math.random() - 0.5) * (o.spread || 0.4),
    (Math.random() - 0.5) * (o.speed || 1), (o.up || 0.6) + Math.random() * (o.speed || 1) * 0.5, (Math.random() - 0.5) * (o.speed || 1), (o.life || 0.8) * (0.6 + Math.random() * 0.8), o.size || 0.09, o.grav === undefined ? -1 : o.grav, 0, 0, 0,
    r * (0.85 + Math.random() * 0.3), g * (0.85 + Math.random() * 0.3), b * (0.85 + Math.random() * 0.3));
}
function updateParticles(world, dt) {
  for (let i = 0; i < PT.n; i++) {
    PT.life[i] -= dt;
    if (PT.life[i] <= 0) { const l = --PT.n; if (i !== l) { for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max0', 'size', 'layer', 'u', 'v', 'r', 'g', 'b', 'grav', 'kind']) PT[k][i] = PT[k][l]; } i--; continue; }
    PT.vy[i] -= PT.grav[i] * dt;
    const nx = PT.x[i] + PT.vx[i] * dt, ny = PT.y[i] + PT.vy[i] * dt, nz = PT.z[i] + PT.vz[i] * dt;
    if (PT.kind[i] === 0 && SOLID[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { PT.vx[i] *= 0.3; PT.vz[i] *= 0.3; PT.vy[i] = 0; continue; }
    PT.x[i] = nx; PT.y[i] = ny; PT.z[i] = nz;
  }
}
const _lc = [1, 1, 1];
function drawParticles(world, cam) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const rx = cy, rz = -sy, ux = sy * sp, uy = cp, uz = cy * sp;
  for (let i = 0; i < PT.n; i++) {
    const x = PT.x[i] - cam.x, y = PT.y[i] - cam.y, z = PT.z[i] - cam.z, s = PT.size[i], k = PT.kind[i];
    let r = PT.r[i], g = PT.g[i], b = PT.b[i], a = 1, buf = dynTex, layer = PT.layer[i], u0 = PT.u[i], v0 = PT.v[i], du = 3 / 16;
    if (k === 2) { buf = dynGlow; a = Math.min(1, PT.life[i] / PT.max0[i] * 1.6); du = 0; }
    else {
      lightRGB(world.getLightRaw(Math.floor(PT.x[i]), Math.floor(PT.y[i]), Math.floor(PT.z[i])), _lc); r *= _lc[0]; g *= _lc[1]; b *= _lc[2];
      if (k === 1) { buf = dynCol; du = 0; }
    }
    buf.v(x - rx * s - ux * s, y - uy * s, z - rz * s - uz * s, u0, v0 + du, layer, r, g, b, a);
    buf.v(x + rx * s - ux * s, y - uy * s, z + rz * s - uz * s, u0 + du, v0 + du, layer, r, g, b, a);
    buf.v(x + rx * s + ux * s, y + uy * s, z + rz * s + uz * s, u0 + du, v0, layer, r, g, b, a);
    buf.v(x - rx * s + ux * s, y + uy * s, z - rz * s + uz * s, u0, v0, layer, r, g, b, a);
  }
}
