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
  static?: boolean
}

export abstract class RigidBody {
  transform: Transform
  shape: Shape
  velocity: Vector2
  restitution: number
  inv_mass: number
  force: Vector2
  isStationary: boolean
  static: boolean

  constructor(props: BodyProps) {
    this.shape = props.shape
    this.transform = props.shape.next
    this.velocity = props.velocity ?? new Vector2({x: 0, y: 0})
    this.isStationary = props.velocity?.MagnitudeSquared() ? false : true
    this.inv_mass = props.mass ? 1/props.mass : 0
    this.restitution = props.restitution
    this.force = new Vector2({x: 0, y: 0})
    this.static = props.static ?? false
  }

  FixedUpdate(timeStep: number) {}

  SetTransform(transform: Transform) {
    this.transform = transform
    this.shape.current = this.shape.next
    this.shape.next = structuredClone(transform)
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
  next: Transform
  current: Transform
  interpolatedTransform: Transform

  constructor(props: ShapeProps) {
    this.interpolatedTransform = structuredClone(props.transform)
    this.current = structuredClone(props.transform)
    this.next = structuredClone(props.transform)
  }

  GetInterpolatedTransform(interpolation: number): Transform {
    const x = this.current.position.x + (this.next.position.x - this.current.position.x) * interpolation
    const y = this.current.position.y + (this.next.position.y - this.current.position.y) * interpolation
    const position = new Vector2({x: x, y: y})
    const rotation = this.current.rotation + (this.next.rotation - this.current.rotation) * interpolation
    return new Transform(
      position,
      rotation
    )
  }

  UpdateTransform(interpolation: number): void {
    this.interpolatedTransform = this.GetInterpolatedTransform(interpolation)
  }

  abstract GenerateCurrentAABB(): AABB
  abstract GenerateNextAABB(): AABB
}

interface AABBProps extends ShapeProps {
  width: number
  height: number
}

class AABB {
  max: Vector2
  min: Vector2
  constructor(min: Vector2, max: Vector2) {
    this.min = min
    this.max = max
  }
}

export class Box extends Shape {
  width: number
  height: number

  constructor(props: AABBProps) {
    super(props)
    this.width = props.width
    this.height = props.height
  }

  GenerateCurrentAABB(): AABB {
    return new AABB(new Vector2({x: this.current.position.x - this.width/2, y: this.current.position.y - this.height/2}), new Vector2({x: this.current.position.x + this.width/2, y: this.current.position.y + this.height/2}))
  }
  GenerateNextAABB(): AABB {
    return new AABB(new Vector2({x: this.next.position.x - this.width/2, y: this.next.position.y - this.height/2}), new Vector2({x: this.next.position.x + this.width/2, y: this.next.position.y + this.height/2}))
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

  GenerateCurrentAABB(): AABB {
    return new AABB(new Vector2({x: this.current.position.x - this.radius, y: this.current.position.y - this.radius}), new Vector2({x: this.current.position.x + this.radius, y: this.current.position.y + this.radius}))
  }
  GenerateNextAABB(): AABB {
    return new AABB(new Vector2({x: this.next.position.x - this.radius, y: this.next.position.y - this.radius}), new Vector2({x: this.next.position.x + this.radius, y: this.next.position.y + this.radius}))
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

  private checkCollision(pair: Pair, interpolation: number): Manifold | null {
    if (pair.bodyA.shape instanceof Circle) {
      if (pair.bodyB.shape instanceof Circle) {
	const collisionData = this.getCollisionCircleVsCircle(pair.bodyA.shape, pair.bodyB.shape, interpolation)
	if (collisionData) {
	  return new Manifold(pair, collisionData)
	}
      }
      else if (pair.bodyB.shape instanceof Box) {
	  const collisionData = this.getCollisionAABBVsCircle(pair.bodyB.shape, pair.bodyA.shape, interpolation)
	  if (collisionData) {
	    return new Manifold(pair, collisionData)
	  }
      }
    } else if (pair.bodyA.shape instanceof Box) {
      if (pair.bodyB.shape instanceof Circle) {
	const collisionData = this.getCollisionCircleVsAABB(pair.bodyB.shape, pair.bodyA.shape, interpolation)
	console.log(collisionData)
	if (collisionData) {
	  return new Manifold(pair, collisionData)
	}
      }
    }
    return null
  }

  private checkCollisionAABBVsAABB(A: AABB, B: AABB): boolean {
    if (A.max.x < B.min.x || A.min.x > B.max.x) {
      return false
    }
    if (A.max.y < B.min.y || A.min.y > B.max.y) {
      return false
    }
    return true
  }

  private getCollisionCircleVsAABB(A: Circle, B: Box, interpolation: number): CollisionData | null {
    const transformA = A.GetInterpolatedTransform(interpolation)
    const transformB = B.GetInterpolatedTransform(interpolation)
    const n = new Vector2({x: transformB.position.x - transformA.position.x, y: transformB.position.y - transformA.position.y})
    const closest = structuredClone(n)

    const x_extent = B.width/2
    const y_extent = B.height/2

    closest.x = clamp(closest.x, -x_extent, x_extent)
    closest.y = clamp(closest.y, -y_extent, y_extent)

    let inside = false

    if (n == closest) {
      inside = true
    }

    const normal = new Vector2({x: closest.x - n.x, y: closest.y - n.y})
    const distanceSquared = Math.pow(normal.x, 2) + Math.pow(normal.y, 2)
    const circleRadius = A.radius

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

  private getCollisionAABBVsCircle(A: Box, B: Circle, interpolation: number): CollisionData | null {
    const transformA = A.GetInterpolatedTransform(interpolation)
    const transformB = B.GetInterpolatedTransform(interpolation)
    const n = new Vector2({x: transformB.position.x - transformA.position.x, y: transformB.position.y - transformA.position.y})
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

  private getCollisionCircleVsCircle(A: Circle, B: Circle, interpolation: number): CollisionData | null {
    let r = A.radius + B.radius
    const radiusSquared = Math.pow(r, 2)
    const transformA = A.GetInterpolatedTransform(interpolation)
    const transformB = B.GetInterpolatedTransform(interpolation)
    const distanceSquared = Math.pow(transformA.position.x - transformB.position.x, 2) + Math.pow(transformA.position.y - transformB.position.y, 2)
    if (radiusSquared < distanceSquared)
      return null
    const normal = new Vector2({x: transformB.position.x - transformA.position.x, y: transformB.position.y - transformA.position.y})
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
	if (bodyA.static && bodyB.static) {
	  continue
	}
	if (bodyA.isStationary && bodyB.isStationary) {
	  continue
	}
	pairs.push(new Pair(bodyA, bodyB))
      }
    }

    const uniquePairs: Array<Pair> = []
    for (let potentialDuplicate of pairs) {
      let isDuplicate = false
      for (let pair of uniquePairs) {
	if (pair.bodyA === potentialDuplicate.bodyB && pair.bodyB === potentialDuplicate.bodyA) {
	  isDuplicate = true
	  break
	}
      }
      if (!isDuplicate) {
	uniquePairs.push(potentialDuplicate)
      }
    }
    return uniquePairs
  }

  private narrowPhase(pairs: Array<Pair>): void {
    const subStepResolution = 4
    for (let pair of pairs) {
      const AABB_A = pair.bodyA.shape.GenerateNextAABB()
      const xMovement_A = Math.abs(pair.bodyA.shape.current.position.x - pair.bodyA.shape.next.position.x)
      const yMovement_A = Math.abs(pair.bodyA.shape.current.position.y - pair.bodyA.shape.next.position.y)
      const xIterations_A = Math.ceil(xMovement_A/((AABB_A.max.x - AABB_A.min.x)/subStepResolution))
      const yIterations_A = Math.ceil(yMovement_A/((AABB_A.max.y - AABB_A.min.y)/subStepResolution))

      const AABB_B = pair.bodyB.shape.GenerateNextAABB()
      const xMovement_B = Math.abs(pair.bodyB.shape.current.position.x - pair.bodyB.shape.next.position.x)
      const yMovement_B = Math.abs(pair.bodyB.shape.current.position.y - pair.bodyB.shape.next.position.y)
      const xIterations_B = Math.ceil(xMovement_B/((AABB_B.max.x - AABB_B.min.x)/subStepResolution))
      const yIterations_B = Math.ceil(yMovement_B/((AABB_B.max.y - AABB_B.min.y)/subStepResolution))

      const xIterations = Math.max(xIterations_A, xIterations_B)
      const yIterations = Math.max(yIterations_A, yIterations_B)

      const iterations = Math.max(xIterations, yIterations) + 1

      for (let i = 0; i <= 1; i+= 1/iterations) {
	const collision = this.checkCollision(pair, i)
	if (collision) {
	  const correctedTransformA = pair.bodyA.shape.GetInterpolatedTransform(i)
	  const correctedTransformB = pair.bodyB.shape.GetInterpolatedTransform(i)
	  pair.bodyA.transform = correctedTransformA
	  pair.bodyB.transform = correctedTransformB
	  collision?.resolveCollision(pair.bodyA, pair.bodyB)
	  break
	}
      }
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

  broadPhase(pairs: Array<Pair>): Array<Pair> {
    const broadPhasePairs: Array<Pair> = []

    for (let pair of pairs) {
      // expand the broad phase collision test AABBs to cover the space between the current and next AABBs
      // this is to prevent fast moving objects from phasing through each other

      const currentA = pair.bodyA.shape.GenerateCurrentAABB()
      const nextA = pair.bodyA.shape.GenerateNextAABB()
      const minA = new Vector2({x: Math.min(currentA.min.x, nextA.min.x), y: Math.min(currentA.min.y, nextA.min.y)})
      const maxA = new Vector2({x: Math.max(currentA.max.x, nextA.max.x), y: Math.max(currentA.max.y, nextA.max.y)})

      const currentB = pair.bodyB.shape.GenerateCurrentAABB()
      const nextB = pair.bodyB.shape.GenerateNextAABB()
      const minB = new Vector2({x: Math.min(currentB.min.x, nextB.min.x), y: Math.min(currentB.min.y, nextB.min.y)})
      const maxB = new Vector2({x: Math.max(currentB.max.x, nextB.max.x), y: Math.max(currentB.max.y, nextB.max.y)})

      const testA = new AABB(minA, maxA)
      const testB = new AABB(minB, maxB)

      if (this.checkCollisionAABBVsAABB(testA, testB)) {
	broadPhasePairs.push(pair)
      }
    }
    return broadPhasePairs
  }

  private SimulatePhysicsStep(timeStep: number, bodies: Array<RigidBody>) {
    const pairs = this.generatePairs(bodies)
    const filteredPairs = this.broadPhase(pairs)
    this.narrowPhase(filteredPairs)
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
