import { onMount, type Component } from 'solid-js';
import { Engine, PhysicsParams } from '../engine/Engine';
import { Transform, Vector2 } from '../math/utils';
import { Ball, BallShape } from '../game/Ball';
import { Barrier, BarrierPanel } from './Barrier';
import { CanvasDrawable, CanvasRenderer } from '../engine/Renderer';
import { Cue } from './Cue';
import { EightBallPool, GameState } from './EightBallPool';


interface SceneProps {
  width: number
  height: number
  physicsParams: PhysicsParams
}

const Table: Component<SceneProps> = (props: SceneProps) => {
  const {width, height} = props

  let canvas: HTMLCanvasElement | undefined;
  let scene: EightBallPool | undefined = undefined

  onMount(() => {
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }


    const renderer = new CanvasRenderer(canvas, ctx)
    const engine = new Engine(props.physicsParams)

    scene = new EightBallPool(renderer)
    console.log(scene)

    engine.Load(scene)
  })

  function handleMouseMove(e: MouseEvent) {
    scene?.cue.SetPosition(new Vector2(e.offsetX, e.offsetY))
  }

  function handleMouseClick(e: MouseEvent) {
    if (scene?.GetState() == GameState.Aiming) {
      scene?.cue.HitBall()
      scene?.SetState(GameState.Simulating)
    }
  }

  return <canvas ref={canvas} width={width} height={height} onmousemove={handleMouseMove} onclick={handleMouseClick}/>
};


export default Table;
