import { Suspense, useEffect, useState } from 'react';
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

// The dashboard stays separate until its hosted address and access are ready.
const employeeTimeUrl = import.meta.env.VITE_EMPLOYEE_TIME_URL?.trim() || (import.meta.env.DEV ? 'http://127.0.0.1:5180/' : '');
const employeeTimeLink = /^https?:\/\//i.test(employeeTimeUrl) || /^\/(?!\/)/.test(employeeTimeUrl) ? employeeTimeUrl : '';

function ToolSymbol({ kind }: { kind: 'time' | 'map' | 'pavers' }) {
  return <svg className="tool-symbol" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {kind === 'time' ? <><circle cx="20" cy="20" r="13"/><path d="M20 11v10l7 4"/></> : kind === 'map' ? <><path d="m6 10 9-4 10 4 9-4v24l-9 4-10-4-9 4V10Z"/><path d="M15 6v24M25 10v24"/><circle cx="25" cy="18" r="3"/></> : <><path d="M5 8h30v24H5zM5 16h30M5 24h30M15 8v8M27 8v8M11 16v8M23 16v8M17 24v8M29 24v8"/></>}
  </svg>;
}

export function App() {
  const hash = useHash();
  const slug = hash.startsWith('#/examples/') ? hash.slice('#/examples/'.length) : null;
  const employeeTime = hash === '#/tools/employee-time';
  const example = examples.find((entry) => entry.slug === slug);
  const Example = example?.component;

  useEffect(() => {
    document.title = example ? `${example.title} · Wisconsin Union Insights` : employeeTime ? 'Employee Time · Wisconsin Union Insights' : 'Wisconsin Union Insights';
  }, [example, employeeTime]);

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header container insights-header">
      <a className="identity" href="#" aria-label="Wisconsin Union Insights home"><span className="brand-accent" aria-hidden="true"/><span><strong>Wisconsin Union</strong><span className="identity-subtitle">Insights</span></span></a>
      <nav aria-label="Main navigation"><a href="#collection">Tools & dashboards</a><a href="#about">About</a></nav>
      <a className="campus-link" href="https://www.wisc.edu/">UW–Madison</a>
    </header>
    <main id="main" className={`container${slug === 'campus-map' || slug === 'terrace-pavers' ? ' map-page' : ''}`}>
      {employeeTime ? <section className="tool-page" aria-labelledby="employee-time-title">
        <a className="back-link" href="#collection">← All tools</a>
        <p className="eyebrow">People & operations</p><h1 id="employee-time-title">Employee Time</h1>
        <p className="intro">Review time blocks, understand staffing patterns, and follow overtime and ACA hours in one place.</p>
        <div className="employee-time-overview">
          <section><h2>A closer look at your team’s time</h2><ul><li>Employee timelines and daily hours</li><li>Hours by period, supervisory organization, and employee type</li><li>Overtime comparisons and extended time-block review</li><li>ACA hours tracking for student and temporary employees</li></ul></section>
          <section className="tool-access" aria-labelledby="time-access"><h2 id="time-access">Open the dashboard</h2>
            {employeeTimeLink ? <><a className="primary-link" href={employeeTimeLink}>Open Employee Time <span aria-hidden="true">↗</span></a>{import.meta.env.DEV && !import.meta.env.VITE_EMPLOYEE_TIME_URL && <p>The local dashboard needs to be running on this computer. In its project folder, run <code>npm run managers</code>.</p>}</> : <p>Shared access is being prepared. Employee Time is currently maintained as a separate dashboard.</p>}
            <p>Use a Workday Time Block History report you are authorized to access. No employee records are included in this Insights site.</p>
          </section>
        </div>
      </section> : slug ? <section className="example-page">
        <a className="back-link" href="#collection">← All tools</a>
        {Example && example ? <><p className="eyebrow">{example.category}</p><h1>{example.title}</h1><p className="intro">{example.description}</p><Suspense fallback={<p className="tool-loading" role="status">Loading tool…</p>}><Example /></Suspense></> : <><h1>Tool not found</h1><p>This tool isn’t available here.</p><a href="#collection">View available tools</a></>}
      </section> : <>
        <section className="insights-intro" aria-labelledby="hero-title"><h1 id="hero-title">A clearer view of the Union.</h1><p>Dashboards and visual tools for understanding our people, operations, and places.</p></section>
        <section id="collection" className="tools-collection" aria-labelledby="collection-title">
          <div className="tools-heading"><h2 id="collection-title">Tools & dashboards</h2><span>A growing collection</span></div>
          <div className="insights-tool-grid">
            <article className="insights-tool-card employee-time-card"><div className="tool-card-top"><ToolSymbol kind="time"/><span className="tool-status">Separate dashboard</span></div><p className="eyebrow">People & operations</p><h3><a href="#/tools/employee-time">Employee Time <span aria-hidden="true">↗</span></a></h3><p>Review employee hours, staffing patterns, overtime, and time blocks that need a closer look.</p><ul className="tool-capabilities"><li>Timelines & daily hours</li><li>Overtime & extended work</li><li>ACA hours tracking</li></ul></article>
            {[...examples].sort((a,b) => Number(b.slug === 'campus-map') - Number(a.slug === 'campus-map')).map(entry => <article className="insights-tool-card" key={entry.slug}><div className="tool-card-top"><ToolSymbol kind={entry.slug === 'campus-map' ? 'map' : 'pavers'}/><span className="tool-status available">Available to explore</span></div><p className="eyebrow">{entry.category}</p><h3><a href={`#/examples/${entry.slug}`}>{entry.title} <span aria-hidden="true">↗</span></a></h3><p>{entry.description}</p><div className="tool-card-note">{entry.slug === 'campus-map' ? 'Dining locations · provider and location filters · campus map' : 'Inscription search · Terrace zones · photo pilot'}</div></article>)}
          </div>
        </section>
        <section id="about" className="insights-about" aria-labelledby="about-title"><details><summary id="about-title">About Wisconsin Union Insights</summary><div className="about-content"><p>This is a growing home for Wisconsin Union dashboards and visualizations. The goal is to make useful information easier to explore and share, while gradually bringing existing analysis tools into a more consistent experience.</p><p>Future additions may cover finances, point-of-sale activity, foot traffic, theater attendance, and other Union operations. Some tools will be intended for authorized staff; public visualizations may also be included where appropriate.</p><p>The available tools are a starting point. Shared hosting and access for staff dashboards are still being developed.</p></div></details></section>
      </>}
    </main>
    <footer className="container insights-footer"><span>Wisconsin Union Insights</span><div><a href="https://union.wisc.edu/">Wisconsin Union ↗</a><a href="https://www.wisc.edu/">UW–Madison ↗</a></div></footer>
  </>;
}
