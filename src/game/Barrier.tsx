import { RigidBody, BodyProps, Box, Circle } from "../engine/Engine";
import { CanvasDrawable } from "../engine/Renderer";

export class BarrierPanel extends Box implements CanvasDrawable {
  Draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#fff"
    ctx.strokeRect(this.interpolatedTransform.position.x - this.width/2, this.interpolatedTransform.position.y - this.height/2, this.width, this.height)
  }
}

export class BarrierCircle extends Circle implements CanvasDrawable {
  Draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.interpolatedTransform.position.x, this.interpolatedTransform.position.y, this.radius, 0, 2 * Math.PI)
    ctx.strokeStyle = "#fff"
    ctx.stroke()
    ctx.restore()
  }
}

interface BarrierProps extends BodyProps {
  shape: BarrierPanel | BarrierCircle
}

export class Barrier extends RigidBody {
  shape: BarrierPanel | BarrierCircle
  constructor(props: BarrierProps) {
    super(props)
    this.shape = props.shape
  }
}
