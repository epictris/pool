import { Scene } from "../engine/Engine";
import { CanvasDrawable, Renderer } from "../engine/Renderer";
import { Transform, Vector2 } from "../math/utils";
import { Ball, BallShape } from "./Ball";
import { Barrier, BarrierCircle, BarrierPanel } from "./Barrier";
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

const createBall = (x: number, y: number, color: string, speed: number = 0, direction: Vector2 = new Vector2({x:0, y: 0}), spin?: Vector2) => {
	const velocity = direction.Mult(speed)
	return new Ball({spin: spin, mass: 100, restitution: 0.55, velocity: velocity, shape: new BallShape({transform: new Transform(new Vector2({x: x, y: y}), 0), radius: 8, color: color})})
}

function createBarrierPanel(x: number, y: number, width: number, height: number) {
	return new Barrier({static: true, restitution: 0.8, shape: new BarrierPanel({transform: new Transform(new Vector2({x: x, y: y}), 0), width: width, height: height})})
}

function createBarrierCircle(x: number, y: number, radius: number) {
	return new Barrier({static: true, restitution: 0.8, shape: new BarrierCircle({transform: new Transform(new Vector2({x: x, y: y}), 0), radius: radius})})
}

function createBarriers(): Array<Barrier> {
	const top = createBarrierPanel(200, 30, 220, 88)
	const upperLeft = createBarrierPanel(30, 207, 74, 224)
	const upperRight = createBarrierPanel(370, 207, 70, 247)
	const lowerLeft = createBarrierPanel(30, 490, 70, 247)
	const lowerRight = createBarrierPanel(370, 490, 70, 247)
	const bottom = createBarrierPanel(200, 670, 340, 85)

	const topLeftCorner1 = createBarrierCircle(90, 62, 12)
	const topLeftCorner2 = createBarrierCircle(55, 95, 12)
	const topRightCorner1 = createBarrierCircle(310, 62, 12)

	const panels = [top, upperLeft, upperRight, lowerLeft, lowerRight, bottom]
	const circles = [topLeftCorner1, topLeftCorner2, topRightCorner1]
	return panels.concat(circles)
}

function createBalls(): Array<Ball> {
	return [
		createBall(200, 480, "red"),

		createBall(190, 498, "yellow"),
		createBall(210, 498, "red"),

		createBall(180, 516, "red"),
		createBall(200, 516, "black"),
		createBall(220, 516, "yellow"),

		createBall(170, 534, "yellow"),
		createBall(190, 534, "red"),
		createBall(210, 534, "yellow"),
		createBall(230, 534, "red"),

		createBall(160, 552, "red"),
		createBall(180, 552, "yellow"),
		createBall(200, 552, "red"),
		createBall(220, 552, "yellow"),
		createBall(240, 552, "yellow"),
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
