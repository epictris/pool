import { Vector2 } from "../math/utils";
import { Ball } from "../game/Ball";
import { CanvasDrawable } from "../engine/Renderer";

interface CueProps {
  cueBall: Ball
}

export class Cue extends CanvasDrawable {
  cueBall: Ball
  tipPosition: Vector2
  visible: boolean
  image: HTMLImageElement
  
  constructor(props: CueProps) {
    super()
    this.cueBall = props.cueBall
    this.visible = true
    this.tipPosition = this.cueBall.transform.position
    this.image = new Image()
    this.image.src = "https://i.imgur.com/CTf7urI.png"
  }

  HitBall() {
    const forceVector = this.cueBall.transform.position.VectorTo(this.tipPosition)
    this.cueBall.ApplyImpulse(forceVector.Mult(10))
  }

  SetPosition(position: Vector2) {
    this.tipPosition = position
  }

  Draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) {
      return
    }
    const angleToBall = this.cueBall.transform.position.AngleTo(this.tipPosition)
    ctx.translate(this.tipPosition.x - this.image.width/2 - 12, this.tipPosition.y)
    ctx.translate(this.image.width/2 + 12, 0)
    ctx.scale(0.1, 0.1)
    ctx.rotate(angleToBall)
    ctx.rotate(-Math.PI/2)
    ctx.translate(0, -100)
    ctx.translate(-this.image.width/2 - 12, 0)
    ctx.drawImage(this.image, 0, 0)
  }
}
