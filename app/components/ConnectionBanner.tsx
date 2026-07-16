type Props = {
  online: boolean;
  pendingWrites: boolean;
};

/**
 * Aviso del estado de conexión: sin conexión (los cambios se encolan) o
 * sincronizando cambios pendientes. No muestra nada cuando todo está al día.
 */
export function ConnectionBanner({ online, pendingWrites }: Props) {
  if (!online) {
    return (
      <div className="conn-banner offline" role="status">
        <span className="dot" />
        <div>
          <strong>Sin conexión</strong>
          <small>Puede seguir consultando. Los cambios se guardarán y sincronizarán al reconectar. El registro de movimientos requiere conexión.</small>
        </div>
      </div>
    );
  }
  if (pendingWrites) {
    return (
      <div className="conn-banner syncing" role="status">
        <span className="dot" />
        <div><strong>Sincronizando cambios…</strong></div>
      </div>
    );
  }
  return null;
}
