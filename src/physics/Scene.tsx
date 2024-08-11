import { onMount, type Component } from 'solid-js';
import { AABB, Body, CanvasRenderer, Circle, Engine, PhysicsParams } from './Engine';
import { Transform, Vector2 } from '../math/utils';

interface SceneProps {
  width: number
  height: number
  physicsParams: PhysicsParams
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
    createBall(100, 650, "white", 1650, new Vector2({x: 0.044, y: -1}), new Vector2({x: 0, y: 300})),

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
  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const engine = new Engine(props.physicsParams, new CanvasRenderer(canvas, ctx))
    for (let object of objects) {
      engine.addBody(object)
    }
    for (let ball of balls) {
      engine.addBody(ball)
    }
    engine.start()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

  })

  return <canvas ref={canvas} width={width} height={height}/>
};


export default Scene;
