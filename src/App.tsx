import type { Component } from 'solid-js';

import logo from './logo.svg';
import styles from './App.module.css';
import Table from './game/Table';

const App: Component = () => {
  return (
    <div class={styles.App}>
      <Table width={400} height={700} physicsParams={{maxStepsPerFrame: 5, targetStepsPerSecond: 120}}/>
    </div>
  );
};

export default App;
