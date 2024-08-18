export class Vector2 {
    x: number;
    y: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    VectorTo(vector: Vector2): Vector2 {
        return new Vector2(this.x - vector.x, this.y - vector.y)
    }

    AngleTo(vector: Vector2): number {
        return Math.atan2(vector.y - this.y, vector.x - this.x)
    }

    Dot(vector: Vector2): number {
        return this.x * vector.x + this.y * vector.y
    }

    Mult(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar)
    }

    MagnitudeSquared(): number {
        return this.x * this.x + this.y * this.y
    }

    static ZERO = new Vector2(0,0)
    
    static Subtract(A: Vector2, B: Vector2): Vector2 {
        return new Vector2(A.x - B.x, A.y - B.y)
    }

    static Add(A: Vector2, B: Vector2): Vector2 {
        return new Vector2(A.x + B.x, A.y + B.y)
    }

    Normalize(): Vector2 {
        const length = Math.sqrt(this.x * this.x + this.y * this.y)
        if (length) {
            this.x /= length
            this.y /= length
        } else {
            this.x = 0
            this.y = 0
        }
        return this

    }

    copy(): Vector2 {
        return new Vector2(this.x, this.y)
    }
}

export class Transform {
    position: Vector2;
    rotation: number
    constructor(position: Vector2, rotation: number) {
        this.position = position
        this.rotation = rotation
    }

    copy(): Transform {
        return new Transform(this.position.copy(), this.rotation)
    }
}

export const clamp = (num: number, min: number, max: number) => {
    return Math.min(Math.max(num, min), max)
}
