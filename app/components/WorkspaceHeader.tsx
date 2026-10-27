type Props = { demo: boolean; pilot: boolean };

/** Contexto de la aplicación, separado del título de la pantalla actual. */
export function WorkspaceHeader({ demo, pilot }: Props) {
  return (
    <header className="workspace-header">
      <p className="breadcrumb">Farmacia <span aria-hidden="true">/</span> <strong>Consulta externa</strong></p>
      {demo ? <span className="environment-label">DEMO · DATOS FICTICIOS</span>
        : pilot ? <span className="environment-label">PILOTO CONTROLADO</span> : null}
    </header>
  );
}
