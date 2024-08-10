import type { Component } from 'solid-js';

import logo from './logo.svg';
import styles from './App.module.css';
import Scene from './physics/Scene';

const App: Component = () => {
  return (
    <div class={styles.App}>
      <Scene width={400} height={700}/>
    </div>
  );
};

export default App;
