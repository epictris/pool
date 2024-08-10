import { onMount, type Component } from 'solid-js';
import {clamp, Transform, Vector2} from '../math/utils'

import Ball from './Ball';

const PHYSICS_STEP = 16

interface SceneProps {
  width: number
  height: number
}

interface BodyProps {
  shape: Shape
  restitution: number
  velocity?: Vector2
  mass?: number
  spin?: Vector2
}

class Body {
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
    this.current = props.transform
  }
  setTransform(props: {transform: Transform}): void {
    this.previous = structuredClone(this.current)
    this.current = props.transform
  }
  abstract render(interpolation: number, ctx: CanvasRenderingContext2D): void
}

interface AABBProps extends ShapeProps {
  width: number
  height: number
}

class AABB extends Shape {
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

class Circle extends Shape {
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

interface PhysicsStateProps {
  bodies: Array<Body>
}

class PhysicsState {
  bodies: Array<Body>
  constructor(props: PhysicsStateProps) {
    this.bodies = props.bodies
  }

  addBody(body: Body): void {
    this.bodies.push(body)
  }

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
    if (radiusSquared <= distanceSquared)
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

  applySpin(body: Body) {
      const spinCoefficient = 1000
      const spin = body.spin.Mult(spinCoefficient)
      body.force = Vector2.Add(body.force, spin)
      body.spin = body.spin.Mult(0.98)
  }

  applyForces(timeStep: number) {
    for (let body of this.bodies) {
      this.applyFriction(body)
      this.applySpin(body)

      const acceleration = body.force.Mult(body.inv_mass);
      body.velocity = Vector2.Add(body.velocity, acceleration.Mult(timeStep))

      if (body.velocity.MagnitudeSquared() < 1) {
        body.velocity = Vector2.ZERO
      }

      body.transform.position = Vector2.Add(body.transform.position, body.velocity.Mult(timeStep))
      body.force = new Vector2({x: 0, y: 0})
    }
  }

  step(timeStep: number) {
    const pairs = this.generatePairs()
    this.resolveCollisions(pairs)
    this.applyForces(timeStep)
  }
}

const createBall = (x: number, y: number, color: string, speed: number = 0, direction: Vector2 = new Vector2({x:0, y: 0}), spin?: Vector2) => {
    const velocity = direction.Mult(speed)
    return new Body({spin: spin, mass: 100, restitution: 0.95, velocity: velocity, shape: new Circle({transform: new Transform({position: new Vector2({x: x, y: y}), rotation: 0}), radius: 10, color: color})})
}


const Scene: Component<SceneProps> = (props: SceneProps) => {
  const {width, height} = props
  const top = new Body({restitution: 0.8, shape: new AABB({transform: new Transform({position: new Vector2({x: 200, y: 30}),rotation: 0}), width: 340, height: 50})})
  const bottom = new Body({restitution: 0.8, shape: new AABB({transform: new Transform({position: new Vector2({x: 200, y: 670}),rotation: 0}), width: 340, height: 50})})
  const left = new Body({restitution: 0.8, shape: new AABB({transform: new Transform({position: new Vector2({x: 30, y: 350}),rotation: 0}), width: 30, height: 640})})
  const right = new Body({restitution: 0.8, shape: new AABB({transform: new Transform({position: new Vector2({x: 370, y: 350}),rotation: 0}), width: 30, height: 640})})
  const balls = [
    createBall(100, 650, "white", 1550, new Vector2({x: 0.05, y: -1}), new Vector2({x: 0, y: 300})),

    createBall(200, 480, "red"),

    createBall(190, 499, "yellow"),
    createBall(210, 499, "red"),

    createBall(180, 518, "red"),
    createBall(200, 518, "black"),
    createBall(220, 518, "yellow"),

    createBall(170, 537, "yellow"),
    createBall(190, 537, "red"),
    createBall(210, 537, "yellow"),
    createBall(230, 537, "red"),

    createBall(160, 556, "red"),
    createBall(180, 556, "yellow"),
    createBall(200, 556, "red"),
    createBall(220, 556, "yellow"),
    createBall(240, 556, "yellow"),
  ]
  const objects = [
    top,
    bottom,
    left,
    right,
  ]
  const state = new PhysicsState({bodies: objects})
  let canvas: HTMLCanvasElement | undefined;
  onMount(() => {
    if (!canvas) {
      return
    }

    for (let ball of balls) {
      state.addBody(ball)
    }

    const ctx = canvas.getContext('2d')
    requestAnimationFrame(loop)
    let previousFrameTime = 0
    let accumulator = 0

    function loop(t: number) {
      const dt = t - previousFrameTime
      previousFrameTime = t
      accumulator += dt

      while (accumulator > PHYSICS_STEP) {
        accumulator -= PHYSICS_STEP
        // process physics step update
        state.step(PHYSICS_STEP/1000)
        for (let object of objects) {
          object.shape.setTransform({transform: object.transform})
        }
      }
      const interpolation = accumulator/PHYSICS_STEP
      // render update
      if (!ctx || !canvas) {
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let object of objects) {
        ctx.save()
        object.shape.render(interpolation, ctx)
        ctx.restore()
        // ctx?.fillRect(object.shape.current.position.x, object.shape.current.position.y, 50, 50)
      }
      requestAnimationFrame(loop);
    }

  })
  return <canvas ref={canvas} width={width} height={height}/>
};

export default Scene;
