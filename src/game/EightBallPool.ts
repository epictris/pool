import { Scene } from "../engine/Engine";
import { CanvasDrawable, Renderer } from "../engine/Renderer";
import { Transform, Vector2 } from "../math/utils";
import { Ball, BallShape } from "./Ball";
import { Barrier, BarrierShape } from "./Barrier";
import { Cue } from "./Cue";

class Background implements CanvasDrawable {
  image: HTMLImageElement
  constructor() {
    const background = new Image()
    background.src = "https://i.imgur.com/o871lO0.jpeg"
    this.image = background
  }
  Draw(ctx: CanvasRenderingContext2D): void {
	ctx.scale(0.57, 0.57)
	ctx.rotate(Math.PI/2)
	ctx.translate(0, -this.image.height)
    ctx.drawImage(this.image, 0, 0)
  }
}

export const createBall = (x: number, y: number, color: string, speed: number = 0, direction: Vector2 = new Vector2({x:0, y: 0}), spin?: Vector2) => {
	const velocity = direction.Mult(speed)
	return new Ball({spin: spin, mass: 100, restitution: 0.55, velocity: velocity, shape: new BallShape({transform: new Transform(new Vector2({x: x, y: y}), 0), radius: 10, color: color})})
}

function createBarriers(): Array<Barrier> {
	const top = new Barrier({restitution: 0.8, shape: new BarrierShape({transform: new Transform(new Vector2({x: 200, y: 30}), 0), width: 340, height: 85})})
	const bottom = new Barrier({restitution: 0.8, shape: new BarrierShape({transform: new Transform(new Vector2({x: 200, y: 670}), 0), width: 340, height: 85})})
	const left = new Barrier({restitution: 0.8, shape: new BarrierShape({transform: new Transform(new Vector2({x: 30, y: 350}), 0), width: 70, height: 640})})
	const right = new Barrier({restitution: 0.8, shape: new BarrierShape({transform: new Transform(new Vector2({x: 370, y: 350}), 0), width: 70, height: 640})})
	return [top, bottom, left, right]
}

function createBalls(): Array<Ball> {
	return [
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
}

export enum GameState {
	Aiming,
	Simulating,
	Paused,
}

export class EightBallPool extends Scene {
	cue: Cue
	state: GameState

	constructor(renderer: Renderer) {
		super(renderer)
		this.state = GameState.Aiming
		this.renderer.AddDrawable(new Background())
		for (let body of createBarriers()) {
			this.AddBody(body)
			this.renderer.AddDrawable(body.shape)
		}
		for (let body of createBalls()) {
			this.AddBody(body)
			this.renderer.AddDrawable(body.shape)
		}

		const cueBall = createBall(200, 200, "white")
		this.cue = new Cue({cueBall: cueBall})
		this.renderer.AddDrawable(this.cue)
		this.AddBody(cueBall)
		this.renderer.AddDrawable(cueBall.shape)
	}

	SetState(state: GameState): void {
		if (state == GameState.Simulating) {
			this.cue.visible = false
		} else {
			this.cue.visible = true
		}
		this.state = state
	}

	GetState(): GameState {
		return this.state
	}

	FixedUpdate(timeStep: number): void {
	}

	PostFixedUpdate(): void {
		if (this.state == GameState.Simulating) {
			if (!this.bodies.find(body => !body.isStationary)) {
				this.SetState(GameState.Aiming)
			}
		}
	}

	Update(timeStep: number): void {

	}

	Render(): void {
		this.renderer.Render()
	}
}
