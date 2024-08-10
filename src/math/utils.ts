export class Vector2 {
    x: number;
    y: number
    constructor(props: { x: number; y: number; }) {
        let {x, y} = props
        this.x = x
        this.y = y
    }

    Dot(vector: Vector2): number {
        return this.x * vector.x + this.y * vector.y
    }

    Mult(scalar: number): Vector2 {
        return new Vector2({x: this.x * scalar, y: this.y * scalar})
    }

    MagnitudeSquared(): number {
        return this.x * this.x + this.y * this.y
    }

    static ZERO = new Vector2({x: 0, y: 0})
    
    static Subtract(A: Vector2, B: Vector2): Vector2 {
        return new Vector2({x: A.x - B.x, y: A.y - B.y})
    }

    static Add(A: Vector2, B: Vector2): Vector2 {
        return new Vector2({x: A.x + B.x, y: A.y + B.y})
    }

    Normalize(): void {
        const length = Math.sqrt(this.x * this.x + this.y * this.y)
        if (length) {
            this.x /= length
            this.y /= length
        } else {
            this.x = 0
            this.y = 0
        }

    }
}

export class Transform {
    position: Vector2;
    rotation: number
    constructor(props: { position: Vector2; rotation: number; }) {
        this.position = props.position
        this.rotation = props.rotation
    }
}

export const clamp = (num: number, min: number, max: number) => {
    return Math.min(Math.max(num, min), max)
}
