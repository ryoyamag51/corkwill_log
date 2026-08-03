export default function Home() {
  return (
    <main className="site-shell">
      <section className="welcome-card" aria-labelledby="site-title">
        <p className="eyebrow">A place to keep things close</p>
        <h1 id="site-title">CorkWill</h1>
        <p className="intro">
          Simple notes, held together in one warm little space.
        </p>
        <a className="log-link" href="https://corkwill.com/log/">
          Open the log <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
