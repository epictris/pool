import type { Component } from 'solid-js';
import { Vector2 } from '../math/utils';

interface BallProps {
  color: string,
  position: Vector2,
  radius: number
}

const Ball: Component<BallProps> = (props: BallProps) => {
  let {color, position, radius} = props
  return (
      <div style={`width: ${radius * 2}px; height: ${radius * 2}px; position: absolute; border-radius: 50%; background: ${color}; left: ${position.x-radius}px; top:${position.y-radius}px`}/>
  );
};

export default Ball;
