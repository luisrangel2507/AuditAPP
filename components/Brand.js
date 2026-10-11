// Marca: logo Mitchell Plastics (versión clara para fondos azules) + nombre de la app
export default function Brand({ size = 'md' }) {
  return (
    <div className={`brand2 ${size}`}>
      <img className="brand2-logo" src="/mitchell-logo-light.png" alt="Mitchell Plastics" />
      <span className="brand2-name">LP<span className="app-accent">App</span><small>Layered Process Audit</small></span>
    </div>
  );
}
