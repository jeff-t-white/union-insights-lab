import { useEffect, useState } from 'react';
import { examples } from './examples';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const slug = hash.startsWith('#/examples/') ? hash.slice('#/examples/'.length) : null;
  const example = examples.find((entry) => entry.slug === slug);
  const Example = example?.component;

  useEffect(() => {
    document.title = `${example ? example.title : 'Union Insights Lab'} · Wisconsin Union`;
  }, [example]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="institution"><div className="container">University of Wisconsin–Madison</div></div>
      <header className="site-header container">
        <a className="identity" href="#" aria-label="Union Insights Lab home">
          <span className="identity-mark" aria-hidden="true">U<span>.</span></span>
          <span><strong>Wisconsin Union</strong><span className="identity-subtitle">Insights Lab</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#collection">The collection</a>
          <a href="#about">About the lab <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <main id="main" className={`container${slug === 'campus-map' ? ' map-page' : ''}`}>
        {slug ? (
          <section className="example-page">
            <a className="back-link" href="#collection">← Back to the collection</a>
            {Example && example ? <><p className="eyebrow">{example.category}</p><h1>{example.title}</h1><p className="intro">{example.description}</p><Example /></> : <><h1>Example not found.</h1><p>This visualization isn’t in the collection yet.</p></>}
          </section>
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <p className="eyebrow"><span className="red-rule" /> A Wisconsin Union exploration</p>
                <h1 id="hero-title">Our Union.<br />A different <em>perspective.</em></h1>
                <p className="intro">Exploring the places, people, and everyday experiences of the Wisconsin Union through data.</p>
                <a className="primary-link" href="#collection">Explore the collection <span aria-hidden="true">↓</span></a>
              </div>
              <aside className="lab-note" aria-label="About this collection">
                <span className="note-number" aria-hidden="true">01 /</span>
                <p className="eyebrow">A space to learn by making</p>
                <p>Real questions.<br />Union data.<br /><span>New ways to see it.</span></p>
                <div className="note-footer">Data visualization · Wisconsin Union</div>
              </aside>
            </section>
            <section id="collection" className="collection" aria-labelledby="collection-title">
              <div className="section-heading"><div><p className="eyebrow">The collection</p><h2 id="collection-title">Visual explorations</h2></div><span className="count">{examples.length} {examples.length === 1 ? 'example' : 'examples'}</span></div>
              {examples.length ? <div className="example-grid">{examples.map((entry) => <a className="example-card" key={entry.slug} href={`#/examples/${entry.slug}`}><p className="eyebrow">{entry.category}</p><h3>{entry.title} <span aria-hidden="true">↗</span></h3><p>{entry.description}</p></a>)}</div> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">+</span><div><h3>A fresh canvas.</h3><p>The collection starts here. As explorations take shape, you’ll find them in this space.</p></div><span className="empty-label">Ready for the first idea</span></div>}
            </section>
            <section id="about" className="about" aria-labelledby="about-title"><p className="eyebrow">Behind the work</p><div><h2 id="about-title">Small experiments.<br />A growing understanding.</h2><p>This lab is a working collection of data visualization examples created alongside Yan Holtz’s D3 & React course, using questions and information from work at the Wisconsin Union.</p><p>Each exploration is a chance to practice, ask a better question, and make our data easier to understand.</p><a className="text-link" href="https://www.react-graph-gallery.com/">Visit the React Graph Gallery <span aria-hidden="true">↗</span></a></div></section>
          </>
        )}
      </main>
      <footer className="container"><span>Union Insights Lab <span className="footer-separator">/</span> A learning project</span><div><a href="https://union.wisc.edu/">Wisconsin Union ↗</a><a href="https://www.wisc.edu/">UW–Madison ↗</a></div></footer>
    </>
  );
}
