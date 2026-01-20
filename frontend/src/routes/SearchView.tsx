import styles from './SearchView.module.css';

export function SearchView() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Search</h2>
      <div className={styles.placeholder}>
        <p>Search functionality coming soon...</p>
        <p className={styles.hint}>Search tracks, artists, and albums</p>
      </div>
    </div>
  );
}
