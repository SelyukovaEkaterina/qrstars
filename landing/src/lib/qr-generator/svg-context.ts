/**
 * Минимальный «canvas 2D», который вместо пикселей пишет SVG.
 * Покрывает ровно то, чем пользуется отрисовка генератора: пути, прямоугольники,
 * дуги, градиенты, текст, `drawImage`. Подряд идущие заливки одного цвета
 * склеиваются в один `<path>`, чтобы файл оставался компактным.
 */

type Paint = string | SvgGradient;

interface DrawState {
  fillStyle: Paint;
  strokeStyle: Paint;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgba(…)` → цвет + прозрачность для SVG. */
function parseColor(color: string): { color: string; opacity: number } {
  const c = color.trim();
  const m8 = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (m8) return { color: `#${m8[1]}`, opacity: parseInt(m8[2], 16) / 255 };
  const rgba = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((x) => Math.round(Number(x)));
    return { color: `rgb(${r},${g},${b})`, opacity: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  }
  return { color: c, opacity: 1 };
}

export class SvgGradient {
  readonly id: string;
  private stops: { offset: number; color: string }[] = [];
  constructor(
    private readonly kind: 'linear' | 'radial',
    private readonly coords: number[],
    seq: number,
  ) {
    this.id = `g${seq}`;
  }
  addColorStop(offset: number, color: string) {
    this.stops.push({ offset, color });
  }
  toDef(): string {
    const stops = this.stops
      .map((s) => {
        const { color, opacity } = parseColor(s.color);
        return `<stop offset="${n(s.offset)}" stop-color="${color}"${opacity < 1 ? ` stop-opacity="${n(opacity)}"` : ''}/>`;
      })
      .join('');
    if (this.kind === 'linear') {
      const [x1, y1, x2, y2] = this.coords.map(n);
      return `<linearGradient id="${this.id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
    }
    const [fx, fy, , cx, cy, r] = this.coords.map(n);
    return `<radialGradient id="${this.id}" gradientUnits="userSpaceOnUse" fx="${fx}" fy="${fy}" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>`;
  }
}

export class SvgContext {
  private body: string[] = [];
  private defs = new Map<string, string>();
  private path = '';
  private hasPoint = false;
  private gradSeq = 0;
  private stack: DrawState[] = [];
  private state: DrawState = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
  };
  /** Копящаяся заливка — подряд идущие фигуры одного цвета уходят в один `<path>`. */
  private pending: { attrs: string; d: string[] } | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly imageHref: (img: CanvasImageSource) => string,
  ) {}

  // ── Состояние ──
  get fillStyle() { return this.state.fillStyle; }
  set fillStyle(v: Paint) { this.state.fillStyle = v; }
  get strokeStyle() { return this.state.strokeStyle; }
  set strokeStyle(v: Paint) { this.state.strokeStyle = v; }
  get lineWidth() { return this.state.lineWidth; }
  set lineWidth(v: number) { this.state.lineWidth = v; }
  get font() { return this.state.font; }
  set font(v: string) { this.state.font = v; }
  get textAlign() { return this.state.textAlign; }
  set textAlign(v: CanvasTextAlign) { this.state.textAlign = v; }
  get textBaseline() { return this.state.textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this.state.textBaseline = v; }
  get globalAlpha() { return this.state.globalAlpha; }
  set globalAlpha(v: number) { this.state.globalAlpha = v; }
  /** Фильтры в SVG-экспорте не нужны (используются только в проверке сканируемости). */
  filter = 'none';

  save() { this.stack.push({ ...this.state }); }
  restore() { const s = this.stack.pop(); if (s) this.state = s; }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new SvgGradient('linear', [x0, y0, x1, y1], ++this.gradSeq);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new SvgGradient('radial', [x0, y0, r0, x1, y1, r1], ++this.gradSeq);
  }

  // ── Пути ──
  beginPath() { this.path = ''; this.hasPoint = false; }
  moveTo(x: number, y: number) { this.path += `M${n(x)} ${n(y)}`; this.hasPoint = true; }
  lineTo(x: number, y: number) {
    this.path += `${this.hasPoint ? 'L' : 'M'}${n(x)} ${n(y)}`;
    this.hasPoint = true;
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.path += `Q${n(cpx)} ${n(cpy)} ${n(x)} ${n(y)}`;
    this.hasPoint = true;
  }
  closePath() { this.path += 'Z'; }
  rect(x: number, y: number, w: number, h: number) {
    this.path += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
    this.hasPoint = true;
  }
  arc(cx: number, cy: number, r: number, start: number, end: number, ccw = false) {
    const sx = cx + r * Math.cos(start);
    const sy = cy + r * Math.sin(start);
    this.path += `${this.hasPoint ? 'L' : 'M'}${n(sx)} ${n(sy)}`;
    let sweep = ccw ? start - end : end - start;
    if (sweep < 0) sweep += Math.PI * 2;
    const sweepFlag = ccw ? 0 : 1;
    if (sweep >= Math.PI * 2 - 1e-6) {
      // Полный круг — две половинки: одна дуга SVG с совпадающими концами не рисуется.
      const mx = cx - (sx - cx);
      const my = cy - (sy - cy);
      this.path += `A${n(r)} ${n(r)} 0 1 ${sweepFlag} ${n(mx)} ${n(my)}A${n(r)} ${n(r)} 0 1 ${sweepFlag} ${n(sx)} ${n(sy)}`;
    } else {
      const ex = cx + r * Math.cos(end);
      const ey = cy + r * Math.sin(end);
      this.path += `A${n(r)} ${n(r)} 0 ${sweep > Math.PI ? 1 : 0} ${sweepFlag} ${n(ex)} ${n(ey)}`;
    }
    this.hasPoint = true;
  }

  // ── Отрисовка ──
  private paintAttrs(paint: Paint, kind: 'fill' | 'stroke'): string {
    const alpha = this.state.globalAlpha;
    if (paint instanceof SvgGradient) {
      this.defs.set(paint.id, paint.toDef());
      return `${kind}="url(#${paint.id})"${alpha < 1 ? ` ${kind}-opacity="${n(alpha)}"` : ''}`;
    }
    const { color, opacity } = parseColor(String(paint));
    const o = opacity * alpha;
    return `${kind}="${color}"${o < 1 ? ` ${kind}-opacity="${n(o)}"` : ''}`;
  }

  private isInvisible(paint: Paint): boolean {
    if (paint instanceof SvgGradient) return this.state.globalAlpha <= 0;
    return parseColor(String(paint)).opacity * this.state.globalAlpha <= 0;
  }

  private emitFill(d: string, rule?: CanvasFillRule) {
    if (!d || this.isInvisible(this.state.fillStyle)) return;
    const attrs = `${this.paintAttrs(this.state.fillStyle, 'fill')}${rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}`;
    // Склеиваем только при nonzero: у evenodd пересечения соседних фигур дадут дырки.
    if (rule === 'evenodd') {
      this.push(`<path ${attrs} d="${d}"/>`);
      return;
    }
    if (this.pending?.attrs === attrs) {
      this.pending.d.push(d);
      return;
    }
    this.flush();
    this.pending = { attrs, d: [d] };
  }

  private flush() {
    if (!this.pending) return;
    this.body.push(`<path ${this.pending.attrs} d="${this.pending.d.join('')}"/>`);
    this.pending = null;
  }

  private push(el: string) {
    this.flush();
    this.body.push(el);
  }

  fill(rule?: CanvasFillRule) { this.emitFill(this.path, rule); }
  fillRect(x: number, y: number, w: number, h: number) {
    this.emitFill(`M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`);
  }
  /** В SVG фон и так прозрачный: очистка всего холста — no-op. */
  clearRect() {}

  stroke() {
    if (!this.path || this.isInvisible(this.state.strokeStyle)) return;
    this.push(`<path fill="none" ${this.paintAttrs(this.state.strokeStyle, 'stroke')} stroke-width="${n(this.state.lineWidth)}" d="${this.path}"/>`);
  }

  fillText(text: string, x: number, y: number) {
    const m = this.state.font.match(/^(?:(\d{3}|bold|normal)\s+)?([\d.]+)px\s+(.+)$/);
    const weight = m?.[1] ?? 'normal';
    const size = m?.[2] ?? '10';
    const family = (m?.[3] ?? 'sans-serif').replace(/"/g, "'");
    const anchor = this.state.textAlign === 'center' ? 'middle' : this.state.textAlign === 'right' || this.state.textAlign === 'end' ? 'end' : 'start';
    const baseline = this.state.textBaseline === 'middle' ? 'central' : this.state.textBaseline === 'top' ? 'hanging' : 'alphabetic';
    this.push(
      `<text x="${n(x)}" y="${n(y)}" font-family="${escapeXml(family)}" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="${baseline}" ${this.paintAttrs(this.state.fillStyle, 'fill')}>${escapeXml(text)}</text>`,
    );
  }

  drawImage(img: CanvasImageSource, ...args: number[]) {
    const href = this.imageHref(img);
    const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
    const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
    const opacity = this.state.globalAlpha < 1 ? ` opacity="${n(this.state.globalAlpha)}"` : '';
    if (args.length === 8) {
      // Кадрирование: вложенный svg с viewBox на нужный участок картинки.
      const [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      this.push(
        `<svg x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" viewBox="${n(sx)} ${n(sy)} ${n(sw)} ${n(sh)}" preserveAspectRatio="none"${opacity}><image width="${iw}" height="${ih}" href="${href}"/></svg>`,
      );
      return;
    }
    const [dx, dy, dw = iw, dh = ih] = args;
    this.push(`<image x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" preserveAspectRatio="none" href="${href}"${opacity}/>`);
  }

  toString(): string {
    this.flush();
    const defs = this.defs.size ? `<defs>${[...this.defs.values()].join('')}</defs>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(this.width)} ${n(this.height)}" width="${n(this.width)}" height="${n(this.height)}">${defs}${this.body.join('')}</svg>\n`;
  }
}
