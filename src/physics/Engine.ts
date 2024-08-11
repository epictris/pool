import { clamp, Transform, Vector2 } from "../math/utils"

export interface PhysicsParams {
  maxStepsPerFrame: number // cap simulation steps per frame to avoid engine freeze if physics step resolution takes too long
  targetStepsPerSecond: number // target simulation steps per second
}

interface BodyProps {
  shape: Shape
  restitution: number
  velocity?: Vector2
  mass?: number
  spin?: Vector2
}

export class Body {
  transform: Transform
  shape: Shape
  velocity: Vector2
  restitution: number
  inv_mass: number
  force: Vector2
  spin: Vector2

  constructor(props: BodyProps) {
    this.shape = props.shape
    this.transform = props.shape.current
    this.velocity = props.velocity ?? new Vector2({x: 0, y: 0})
    this.inv_mass = props.mass ? 1/props.mass : 0
    this.restitution = props.restitution
    this.force = new Vector2({x: 0, y: 0})
    this.spin = props.spin ?? new Vector2({x: 0, y: 0})
  }
}

interface ShapeProps {
  transform: Transform
}

abstract class Shape {
  current: Transform
  previous: Transform
  constructor(props: ShapeProps) {
    this.previous = structuredClone(props.transform)
    this.current = structuredClone(props.transform)
  }
  setTransform(props: {transform: Transform}): void {
    this.previous = this.current
    this.current = structuredClone(props.transform)
  }
  abstract render(interpolation: number, ctx: CanvasRenderingContext2D): void
}

interface AABBProps extends ShapeProps {
  width: number
  height: number
}

export class AABB extends Shape {
  width: number
  height: number

  constructor(props: AABBProps) {
    super(props)
    this.width = props.width
    this.height = props.height
  }

  render(interpolation: number, ctx: CanvasRenderingContext2D): void {
    const x = this.previous.position.x + (this.current.position.x - this.previous.position.x) * interpolation
    const y = this.previous.position.y + (this.current.position.y - this.previous.position.y) * interpolation
    ctx.fillRect(x - this.width/2, y - this.height/2, this.width, this.height)
  }
}

interface CircleProps extends ShapeProps {
  radius: number
  color?: string
}

export class Circle extends Shape {
  radius: number
  color: string

  constructor(props: CircleProps) {
    super(props)
    this.radius = props.radius
    this.color = props.color ?? '#ffffff'
  }

  render(interpolation: number, ctx: CanvasRenderingContext2D): void {
    const x = this.previous.position.x + (this.current.position.x - this.previous.position.x) * interpolation
    const y = this.previous.position.y + (this.current.position.y - this.previous.position.y) * interpolation
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, 2 * Math.PI)
    ctx.fillStyle = this.color
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

class CollisionData {
  penetration: number
  normal: Vector2
  constructor(penetration: number, normal: Vector2) {
    this.penetration = penetration
    this.normal = normal
  }
}

class Manifold {
  pair: Pair
  collisionData: CollisionData
  constructor(pair: Pair, collisionData: CollisionData) {
    this.pair = pair
    this.collisionData = collisionData
  }

  applyPositionalCorrection() {
    const percent = 0.2
    const slop = 0.01
    const correction = Math.max(this.collisionData.penetration - slop, 0) / ((this.pair.bodyA.inv_mass + this.pair.bodyB.inv_mass) * percent);
    const correctionVector = this.collisionData.normal.Mult(correction)
    this.pair.bodyA.transform.position = Vector2.Subtract(this.pair.bodyA.transform.position, correctionVector.Mult(this.pair.bodyA.inv_mass))
    this.pair.bodyB.transform.position = Vector2.Add(this.pair.bodyB.transform.position, correctionVector.Mult(this.pair.bodyB.inv_mass))
  }

  resolveCollision(A: Body, B:Body): void {
    const relativeVelocity = new Vector2({x: B.velocity.x - A.velocity.x, y: B.velocity.y - A.velocity.y})
    const velocityAlongNormal = relativeVelocity.Dot(this.collisionData.normal)

    if (velocityAlongNormal > 0) {
      // bodies are moving away from each other
      return
    }

    const restitution = Math.min(A.restitution, B.restitution)

    const impulseScalar = (-(1 + restitution) * velocityAlongNormal) / (A.inv_mass + B.inv_mass)
    const impulse = this.collisionData.normal.Mult(impulseScalar)

    // apply impulse
    this.pair.bodyA.velocity = Vector2.Subtract(this.pair.bodyA.velocity, impulse.Mult(A.inv_mass)) 
    this.pair.bodyB.velocity = Vector2.Add(this.pair.bodyB.velocity, impulse.Mult(B.inv_mass)) 

    this.applyPositionalCorrection()
  }
}

class Pair {
  bodyA: Body
  bodyB: Body
  constructor(bodyA: Body, bodyB: Body) {
    this.bodyA = bodyA
    this.bodyB = bodyB
  }
}

export class Engine {
  maxStepsPerFrame: number
  stepDuration: number
  previousFrameTime: number
  engineTimeSincePreviousStep: number
  renderer: CanvasRenderer
  bodies: Array<Body>

  constructor(physicsParams: PhysicsParams, renderer: CanvasRenderer) {
    this.maxStepsPerFrame = physicsParams.maxStepsPerFrame
    this.stepDuration = 1000/physicsParams.targetStepsPerSecond
    this.bodies = []
    this.previousFrameTime = 0
    this.engineTimeSincePreviousStep = 0
    this.renderer = renderer
  }

  addBody(body: Body): void {
    this.bodies.push(body)
  }

  // maybe define maximum position difference from previous frame (half the width of the smallest object) - if exceeds difference check in steps
  checkCollision(pair: Pair): Manifold | null {
    if (pair.bodyA.shape instanceof Circle) {
      if (pair.bodyB.shape instanceof Circle) {
	const collisionData = this.checkCollisionCircleVsCircle(pair.bodyA.shape, pair.bodyB.shape)
	if (collisionData) {
	  return new Manifold(pair, collisionData)
	}
      }
      else if (pair.bodyB.shape instanceof AABB) {
	const collisionData = this.checkCollisionAABBvsCircle(pair.bodyB.shape, pair.bodyA.shape)
	if (collisionData) {
	  return new Manifold(pair, collisionData)
	}
      }
    }
    return null
  }

  checkCollisionAABBvsCircle(A: AABB, B: Circle): CollisionData | null {
    const n = new Vector2({x: B.current.position.x - A.current.position.x, y: B.current.position.y - A.current.position.y})
    const closest = structuredClone(n)

    const x_extent = A.width/2
    const y_extent = A.height/2

    closest.x = clamp(closest.x, -x_extent, x_extent)
    closest.y = clamp(closest.y, -y_extent, y_extent)

    let inside = false

    if (n == closest) {
      inside = true
    }

    const normal = new Vector2({x: closest.x - n.x, y: closest.y - n.y})
    const distanceSquared = Math.pow(normal.x, 2) + Math.pow(normal.y, 2)
    const circleRadius = B.radius

    if (distanceSquared > circleRadius * circleRadius && !inside) {
      return null
    }


    const distance = Math.sqrt(distanceSquared)

    normal.Normalize()

    const penetration = circleRadius - distance

    if (inside) {
      return new CollisionData(penetration, new Vector2({x: -normal.x, y: -normal.y}))
    }
    return new CollisionData(penetration, normal)
  }

  checkCollisionCircleVsCircle(A: Circle, B: Circle): CollisionData | null {
    let r = A.radius + B.radius
    const radiusSquared = Math.pow(r, 2)
    const distanceSquared = Math.pow(A.current.position.x - B.current.position.x, 2) + Math.pow(A.current.position.y - B.current.position.y, 2)
    if (radiusSquared < distanceSquared)
      return null
    const normal = new Vector2({x: B.current.position.x - A.current.position.x, y: B.current.position.y - A.current.position.y})
    normal.Normalize()
    const distance = Math.sqrt(distanceSquared)
    const penetration = distance - r
    return new CollisionData(penetration, normal)
  }

  generatePairs(): Array<Pair> {
    const pairs: Array<Pair> = []

    for (let bodyA of this.bodies) {
      for (let bodyB of this.bodies) {
	if (bodyA === bodyB) {
	  continue
	}
	pairs.push(new Pair(bodyA, bodyB))
      }
    }

    const uniquePairs: Array<Pair> = []
    for (let potentialDuplicate of pairs) {
      let isDuplicate = false
      for (let pair of uniquePairs) {
	if (pair.bodyA == potentialDuplicate.bodyB && pair.bodyB == potentialDuplicate.bodyA)
	  isDuplicate = true
	break
      }
      if (!isDuplicate) {
	uniquePairs.push(potentialDuplicate)
      }
    }
    return uniquePairs
  }

  resolveCollisions(pairs: Array<Pair>): void {
    for (let pair of pairs) {
      const collision = this.checkCollision(pair)
      collision?.resolveCollision(pair.bodyA, pair.bodyB)
    }
  }

  applyFriction(body: Body) {
    const frictionCoefficient = 9000
    const frictionVector = body.velocity.Mult(-1)
    frictionVector.Normalize()
    const friction = frictionVector.Mult(frictionCoefficient)
    body.force = Vector2.Add(body.force, friction)
  }

  applySpin(body: Body, timeStep: number) {
    const spinCoefficient = 1000
    const spinDecayCoefficient = 1.1
    const spin = body.spin.Mult(spinCoefficient)
    body.force = Vector2.Add(body.force, spin)
    const spinReduction = body.spin.Mult(spinDecayCoefficient * timeStep)
    body.spin = Vector2.Subtract(body.spin, spinReduction)
  }

  applyForces(timeStep: number) {
    for (let body of this.bodies) {
      this.applyFriction(body)
      this.applySpin(body, timeStep)

      const acceleration = body.force.Mult(body.inv_mass);
      body.velocity = Vector2.Add(body.velocity, acceleration.Mult(timeStep))

      if (body.velocity.MagnitudeSquared() < 1) {
	body.velocity = Vector2.ZERO
      }

      body.transform.position = Vector2.Add(body.transform.position, body.velocity.Mult(timeStep))
      body.force = new Vector2({x: 0, y: 0})
    }
  }

  updateShapes() {
    for (let body of this.bodies) {
      body.shape.setTransform({transform: body.transform})
    }
  }

  fixedUpdate(timeStep: number) {
    const pairs = this.generatePairs()
    this.resolveCollisions(pairs)
    this.applyForces(timeStep)
    this.updateShapes()
  }
  start() {
    requestAnimationFrame(update)
    const engine = this

    function update(t: number) {
      const deltaTime = t - engine.previousFrameTime
      engine.previousFrameTime = t
      engine.engineTimeSincePreviousStep += deltaTime

      // cap accumulator to avoid engine freeze if physics step resolution takes too long
      engine.engineTimeSincePreviousStep = Math.min(engine.engineTimeSincePreviousStep, engine.stepDuration * engine.maxStepsPerFrame)

      while (engine.engineTimeSincePreviousStep > engine.stepDuration) {
	engine.engineTimeSincePreviousStep -= engine.stepDuration
	// process physics step update
	engine.fixedUpdate(engine.stepDuration/1000)
      }

      const stepInterpolation = engine.engineTimeSincePreviousStep/engine.stepDuration
      engine.renderer.update(stepInterpolation, engine.bodies.map(body => body.shape))
      requestAnimationFrame(update);
    }
  }

}

export class CanvasRenderer {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas
    this.ctx = ctx
  }
  update(stepInterpolation: number, shapes: Array<Shape>) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let shape of shapes) {
      this.ctx.save()
      shape.render(stepInterpolation, this.ctx)
      this.ctx.restore()
    }

  }
}
