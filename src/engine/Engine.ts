import { clamp, Transform, Vector2 } from "../math/utils"
import { Renderer } from "./Renderer"

export interface PhysicsParams {
  maxStepsPerFrame: number // cap simulation steps per frame to avoid engine freeze if physics step resolution takes too long
  targetStepsPerSecond: number // target simulation steps per second
}

export interface BodyProps {
  shape: Shape
  restitution: number
  velocity?: Vector2
  mass?: number
  spin?: Vector2
}

export abstract class RigidBody {
  transform: Transform
  shape: Shape
  velocity: Vector2
  restitution: number
  inv_mass: number
  force: Vector2
  isStationary: boolean

  constructor(props: BodyProps) {
    this.shape = props.shape
    this.transform = props.shape.current
    this.velocity = props.velocity ?? new Vector2({x: 0, y: 0})
    this.isStationary = props.velocity?.MagnitudeSquared() ? false : true
    this.inv_mass = props.mass ? 1/props.mass : 0
    this.restitution = props.restitution
    this.force = new Vector2({x: 0, y: 0})
  }

  FixedUpdate(timeStep: number) {}

  SetTransform(transform: Transform) {
    this.transform = transform
    this.shape.previous = this.shape.current
    this.shape.current = structuredClone(transform)
  }

  ApplyForce(force: Vector2): void {
    this.force = Vector2.Add(this.force, force)
  }

  ApplyImpulse(impulse: Vector2): void {
    this.velocity = Vector2.Add(this.velocity, impulse)
  }
}

interface ShapeProps {
  transform: Transform
}

export abstract class Shape {
  current: Transform
  previous: Transform
  interpolatedTransform: Transform

  constructor(props: ShapeProps) {
    this.interpolatedTransform = structuredClone(props.transform)
    this.previous = structuredClone(props.transform)
    this.current = structuredClone(props.transform)
  }

  UpdateTransform(interpolation: number): void {
    const x = this.previous.position.x + (this.current.position.x - this.previous.position.x) * interpolation
    const y = this.previous.position.y + (this.current.position.y - this.previous.position.y) * interpolation
    const position = new Vector2({x: x, y: y})
    const rotation = this.previous.rotation + (this.current.rotation - this.previous.rotation) * interpolation
    this.interpolatedTransform = new Transform(
      position,
      rotation
    )
  }
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

  resolveCollision(A: RigidBody, B:RigidBody): void {
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
  bodyA: RigidBody
  bodyB: RigidBody
  constructor(bodyA: RigidBody, bodyB: RigidBody) {
    this.bodyA = bodyA
    this.bodyB = bodyB
  }
}

export abstract class Scene {
  bodies: Array<RigidBody>
  renderer: Renderer
  constructor(renderer: Renderer) {
    this.bodies = []
    this.renderer = renderer
  }

  FixedUpdate(timeStep: number) {

  }

  PostFixedUpdate() {

  }

  Update(deltaTime: number) {

  }

  Render() {

  }

  AddBody(body: RigidBody) {
    this.bodies.push(body)
  }
}

export class Engine {
  maxStepsPerFrame: number
  stepDuration: number
  previousFrameTime: number
  engineTimeSincePreviousStep: number
  scene?: Scene

  constructor(physicsParams: PhysicsParams) {
    this.maxStepsPerFrame = physicsParams.maxStepsPerFrame
    this.stepDuration = 1000/physicsParams.targetStepsPerSecond
    this.previousFrameTime = 0
    this.engineTimeSincePreviousStep = 0
  }

  // maybe define maximum position difference from previous frame (half the width of the smallest object) - if exceeds difference check in steps
  private checkCollision(pair: Pair): Manifold | null {
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

  private checkCollisionAABBvsCircle(A: AABB, B: Circle): CollisionData | null {
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

  private checkCollisionCircleVsCircle(A: Circle, B: Circle): CollisionData | null {
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

  private generatePairs(bodies: Array<RigidBody>): Array<Pair> {
    const pairs: Array<Pair> = []

    for (let bodyA of bodies) {
      for (let bodyB of bodies) {
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

  private resolveCollisions(pairs: Array<Pair>): void {
    for (let pair of pairs) {
      const collision = this.checkCollision(pair)
      collision?.resolveCollision(pair.bodyA, pair.bodyB)
    }
  }

  private applyForces(timeStep: number, bodies: Array<RigidBody>) {
    for (let body of bodies) {
      body.FixedUpdate(timeStep)

      const acceleration = body.force.Mult(body.inv_mass);
      body.velocity = Vector2.Add(body.velocity, acceleration.Mult(timeStep))

      if (body.velocity.MagnitudeSquared() < 1) {
	body.velocity = Vector2.ZERO
	body.isStationary = true
      } else {
	body.isStationary = false
      }

      const position = Vector2.Add(body.transform.position, body.velocity.Mult(timeStep))
      body.SetTransform(new Transform(position, body.transform.rotation))
      body.force = new Vector2({x: 0, y: 0})
    }
  }

  private SimulatePhysicsStep(timeStep: number, bodies: Array<RigidBody>) {
    const pairs = this.generatePairs(bodies)
    this.resolveCollisions(pairs)
    this.applyForces(timeStep, bodies)
  }

  Load(scene: Scene) {
    requestAnimationFrame(loop)
    const engine = this

    function loop(t: number) {
      let deltaTime = t - engine.previousFrameTime
      engine.previousFrameTime = t
      engine.engineTimeSincePreviousStep += deltaTime

      // cap accumulator to avoid engine freeze if physics step resolution takes too long
      if (engine.engineTimeSincePreviousStep > engine.stepDuration * engine.maxStepsPerFrame) {
	engine.engineTimeSincePreviousStep = engine.stepDuration * engine.maxStepsPerFrame
	deltaTime = engine.engineTimeSincePreviousStep - deltaTime
      }

      while (engine.engineTimeSincePreviousStep > engine.stepDuration) {
	engine.engineTimeSincePreviousStep -= engine.stepDuration
	// process physics step update
	scene.FixedUpdate(engine.stepDuration/1000)
	engine.SimulatePhysicsStep(engine.stepDuration/1000, scene.bodies)
	scene.PostFixedUpdate()
      }

      const stepInterpolation = engine.engineTimeSincePreviousStep/engine.stepDuration
      for (let body of scene.bodies) {
	body.shape.UpdateTransform(stepInterpolation)
      }
      scene.Update(deltaTime)
      scene.Render()
      requestAnimationFrame(loop);
    }
  }

}
