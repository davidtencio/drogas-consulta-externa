type Props = {
  countAt: string;
  action: "anular" | "editar";
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nombre del campo cuando el aviso va dentro de un formulario nativo. */
  name?: string;
};

/**
 * Aviso para corregir un movimiento anterior a la última toma de inventario: si la
 * diferencia de esa toma ya se compensó con un ajuste, la corrección la duplicaría.
 * Exige una confirmación explícita.
 */
export function CountAfterMovementWarning({ countAt, action, checked, onChange, name }: Props) {
  const date = new Date(countAt).toLocaleString("es-CR");
  return (
    <div className="count-warning" role="note">
      <strong>Hay una toma de inventario posterior ({date})</strong>
      <p>
        Este movimiento es anterior a esa toma. Al {action}lo, el saldo actual cambia. Si la diferencia que
        encontró la toma ya se corrigió con otro ingreso o egreso de ajuste, esta corrección la duplicaría y el
        saldo dejaría de coincidir con lo físico.
      </p>
      <label className="confirm-check">
        <input type="checkbox" name={name} value="true" required checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Confirmo que la diferencia de esa toma no se ajustó ya por otra vía.
      </label>
    </div>
  );
}
