import styles from './LibraryView.module.css';

export function LibraryView() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Library</h2>
      <div className={styles.placeholder}>
        <p>Library browser coming soon...</p>
        <p className={styles.hint}>Will show artists, albums, and playlists</p>
      </div>
    </div>
  );
}
