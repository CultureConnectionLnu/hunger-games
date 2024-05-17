"use client";
import { useEffect, useRef } from "react";

const config = {
  colors: {
    start: "rgb(255, 69, 0)", // Example start color
    end: "rgb(255, 165, 0)", // Example end color
  },
  heat: 100,
};

function radomMinMax(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomXY(this: { x: number; y: number }, cx: number, cy: number) {
  return {
    x: radomMinMax(this.x - cx, this.x + cx),
    y: radomMinMax(this.y - cy * Math.random(), this.y - cy * Math.random()),
  };
}

class Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  bezierPoints: { x: number; y: number }[];
  speed: number;
  t: number;
  fireplace: Fireplace;
  randomXY: typeof randomXY;

  constructor(fireplace: Fireplace) {
    this.randomXY = randomXY.bind(this);
    this.fireplace = fireplace;
    this.x = radomMinMax(fireplace.size.cx - 50, fireplace.size.cx + 50);
    this.y = fireplace.size.cy;
    this.size = 8;
    this.color = config.colors.start;
    this.bezierPoints = [
      { x: this.x, y: this.y },
      this.randomXY(100, 50),
      this.randomXY(80, 150),
      this.randomXY(10, 300),
    ];
    this.speed = 0.01;
    this.t = 0;
  }

  updateOnMouse() {
    const dx = this.fireplace.mouse.x - this.x;
    const dy = this.fireplace.mouse.y - this.y;
    const distance = dx ** 2 + dy ** 2;
    const force = -this.fireplace.mouse.radius / distance;
    let angle = 0;

    if (distance < this.fireplace.mouse.radius) {
      angle = Math.atan2(dy, dx);
      this.bezierPoints.forEach((point) => {
        point.x += force * Math.cos(angle);
        point.y += force * Math.sin(angle);
      });
    }
  }

  updateColors() {
    let [, r, g, b] = this.fireplace.rgb.start.map(Number);
    const dx = this.fireplace.size.cx - this.x;
    const dy = this.fireplace.size.cy - this.y;
    const distance = dx ** 2 + dy ** 2;
    r = Math.ceil(
      Math.max(this.fireplace.rgb.end[1], r - distance * this.speed),
    );
    g = Math.ceil(
      Math.max(this.fireplace.rgb.end[2], g - distance * this.speed),
    );
    b = Math.ceil(
      Math.max(this.fireplace.rgb.end[3], b - distance * this.speed),
    );
    this.color = `rgb(${[r, g, b].join(",")})`;
  }

  updateParticles([p0, p1, p2, p3]: { x: number; y: number }[]) {
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    this.t += this.speed;

    const xt = ax * this.t ** 3 + bx * this.t ** 2 + cx * this.t + p0.x;
    const yt = ay * this.t ** 3 + by * this.t ** 2 + cy * this.t + p0.y;

    if (this.t > 1) this.t = 0;

    this.size -= 0.05;
    if (this.size < 0.5) this.size = 0.5;

    this.x = xt;
    this.y = yt;
  }

  update() {
    this.updateParticles(this.bezierPoints);
    this.updateOnMouse();
    this.updateColors();
  }

  draw(context: CanvasRenderingContext2D) {
    context.fillStyle = this.color;
    context.fillRect(this.x, this.y, this.size, this.size);
  }
}

class Fireplace {
  cnv: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  size = { w: 0, h: 0, cx: 0, cy: 0 };
  particles: Particle[] = [];
  rgb: { start: RegExpExecArray; end: RegExpExecArray };
  particlesSpawnRate = 10;
  mouse = {
    radius: 3000,
    x: undefined as number | undefined,
    y: undefined as number | undefined,
  };

  constructor() {
    this.rgb = {
      start: /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/.exec(
        config.colors.start,
      )!,
      end: /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/.exec(config.colors.end)!,
    };
    window.addEventListener("mousemove", this.handleMouseMove.bind(this));
    window.addEventListener("touchmove", this.handleTouchMove.bind(this));
  }

  handleMouseMove(event: MouseEvent) {
    this.mouse.x = event.x;
    this.mouse.y = event.y;
  }

  handleTouchMove(event: TouchEvent) {
    this.mouse.x = event.touches[0].clientX;
    this.mouse.y = event.touches[0].clientY;
  }

  init() {
    this.createCanvas();
    this.updateAnimation();
  }

  createCanvas() {
    this.cnv = document.createElement("canvas");
    this.ctx = this.cnv.getContext("2d")!;
    this.setCanvasSize();
    document.body.appendChild(this.cnv);
    window.addEventListener("resize", this.setCanvasSize.bind(this));
  }

  setCanvasSize() {
    if (this.cnv) {
      this.size.w = this.cnv.width = 100;
      this.size.h = this.cnv.height = 100;
      this.size.cx = this.size.w / 2;
      this.size.cy = this.size.h / 2 + 200;
    }
  }

  generateParticles() {
    for (let i = 0; i < this.particlesSpawnRate; i++) {
      this.particles.push(new Particle(this));
    }
    const particlesShift =
      this.particles.length > config.heat
        ? this.particlesSpawnRate
        : this.particlesSpawnRate / 2;
    for (let i = 0; i < particlesShift; i++) {
      this.particles.shift();
    }
  }

  drawParticles() {
    this.particles.forEach((particle) => particle.update());
    this.particles.forEach((particle) => particle.draw(this.ctx!));
    this.generateParticles();
  }

  updateCanvas() {
    if (this.ctx) {
      this.ctx.fillStyle = "rgb(22, 22, 25)";
      this.ctx.fillRect(0, 0, this.size.w, this.size.h);
      this.ctx.shadowColor = config.colors.end;
      this.ctx.shadowBlur = 25;
    }
  }

  updateAnimation() {
    this.updateCanvas();
    this.drawParticles();
    requestAnimationFrame(this.updateAnimation.bind(this));
  }
}

export function Fire() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fireplace = new Fireplace();
    fireplace.init();
    console.log("setup canvas");
    return () => {
      if (canvasRef.current) {
        canvasRef.current.remove();
      }
    };
  }, []);

  return <canvas ref={canvasRef}></canvas>;
}
