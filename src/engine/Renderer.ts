
export abstract class Renderer {
  drawables: Array<Drawable>
  constructor() {
    this.drawables = []
  }
  AddDrawable(drawable: Drawable) {
    this.drawables.push(drawable)
  }
  abstract Render(): void
}

export abstract class Drawable {
}

export abstract class CanvasDrawable implements Drawable {
  abstract Draw(ctx: CanvasRenderingContext2D): void
}


export class CanvasRenderer extends Renderer {
  drawables: Array<CanvasDrawable>
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    super()
    this.canvas = canvas
    this.ctx = ctx
    this.drawables = []
  }

  Render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let drawable of this.drawables) {
      this.ctx.save()
      drawable.Draw(this.ctx)
      this.ctx.restore()
    }
  }
}
