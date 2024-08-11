import { RigidBody, BodyProps, AABB } from "../engine/Engine";
import { CanvasDrawable } from "../engine/Renderer";

export class BarrierShape extends AABB implements CanvasDrawable {
  Draw(ctx: CanvasRenderingContext2D): void {
    return
    ctx.strokeStyle = "#fff"
    ctx.strokeRect(this.interpolatedTransform.position.x - this.width/2, this.interpolatedTransform.position.y - this.height/2, this.width, this.height)
  }
}

interface BarrierProps extends BodyProps {
  shape: BarrierShape
}

export class Barrier extends RigidBody {
  shape: BarrierShape
  constructor(props: BarrierProps) {
    super(props)
    this.shape = props.shape
  }
}
