export function Accordion({ items }) {
  return <div className="accordion">{items.map((item, index) => <details key={item.title} open={index === 0}>
    <summary><h2>{item.title}</h2><span aria-hidden="true">+</span></summary>
    <div className="accordion-content">{item.content}</div>
  </details>)}</div>;
}
