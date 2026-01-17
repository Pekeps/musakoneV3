import styles from './App.module.css';

export const App = () => {
  return (
    <div class={styles.app}>
      <header class={styles.header}>
        <h1>MusakoneV3</h1>
        <p>Mopidy Web Frontend</p>
      </header>
      <main class={styles.main}>
        <p>Welcome to MusakoneV3 - Loading...</p>
      </main>
    </div>
  );
};
