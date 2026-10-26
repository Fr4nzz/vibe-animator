// Temporary plate for a chapter whose scene module is not built yet: chapter number and title on ink.
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H } from '../engine/gl';
import { rgba, F, font, PlateBG, Layers, figHeader, tw } from './_kit';

export default class Placeholder extends Scene {
  bg = new PlateBG();
  L = new Layers();
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const e = { start: this.ctx.start, params: this.ctx.params };
    this.bg.render(renderer, out, 0, f.t, f.t * 6, 0);
    this.L.clear();
    const c = this.L.ink.ctx;
    const a = tw(f.t, e.start, e.start + 0.5);
    figHeader(c, e.params?.fig ?? 'CH.', String(e.params?.title ?? '').toUpperCase(), a, false);
    c.save(); c.globalAlpha = a; c.fillStyle = rgba('bone', 0.9); c.textAlign = 'center';
    c.font = font(F.serif(600, true), 96); c.fillText(String(e.params?.title ?? ''), W / 2, H / 2);
    c.font = font(F.mono(500), 24); c.fillStyle = rgba('bone', 0.5); c.fillText('IN PROGRESS', W / 2, H / 2 + 60);
    c.restore();
    this.L.composite(renderer, comp, out, 0, false);
    return { paper: 0, bloom: 0.1, vignette: 0.3, grain: 0.035, halation: 0, ca: 0.2 };
  }
}
