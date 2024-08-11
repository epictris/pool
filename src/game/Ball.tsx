import { Vector2 } from "../math/utils";
import { RigidBody, BodyProps, Circle } from "../engine/Engine";
import { CanvasDrawable } from "../engine/Renderer";


export class BallShape extends Circle implements CanvasDrawable {
  Draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.interpolatedTransform.position.x, this.interpolatedTransform.position.y, this.radius, 0, 2 * Math.PI)
    ctx.fillStyle = this.color
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

export interface BallProps extends BodyProps {
  shape: BallShape
  spin?: Vector2
}

export class Ball extends RigidBody {
  shape: BallShape
  spin: Vector2

  private SPIN_COEFFICIENT = 1000
  private SPIN_DECAY_COEFFICIENT = 1.1
  private FRICTION_COEFFICIENT = 9000

  constructor(props: BallProps) {
    super(props)
    this.spin = props.spin ?? new Vector2({x: 0, y: 0})
    this.shape = props.shape
  }

  applySpin(timeStep: number) {
    const spin = this.spin.Mult(this.SPIN_COEFFICIENT)
    this.ApplyForce(spin)
    const spinReduction = this.spin.Mult(this.SPIN_DECAY_COEFFICIENT * timeStep)
    this.spin = Vector2.Subtract(this.spin, spinReduction)
  }

  applyFriction() {
    const friction = this.velocity.Mult(-1).Normalize().Mult(this.FRICTION_COEFFICIENT)
    this.ApplyForce(friction)
  }

  FixedUpdate(timeStep: number): void {
    this.applySpin(timeStep)
    this.applyFriction()
  }
}
