import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  name?: string;
  label?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
};

/** Campo opcional que permanece oculto hasta que el usuario decide usarlo. */
export function ObservationField({ name = "note", label = "Observación", placeholder = "Escriba una aclaración breve…", onValueChange }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button type="button" className="observation-toggle" onClick={() => setOpen(true)}><Icon name="note" size={15} /> Agregar observación</button>;
  }

  return (
    <div className="observation-field">
      <label>{label}<textarea name={name} rows={3} maxLength={1000} placeholder={placeholder} autoFocus onChange={(e) => onValueChange?.(e.target.value)} /></label>
      <button type="button" className="observation-remove" onClick={() => { onValueChange?.(""); setOpen(false); }}>Quitar observación</button>
    </div>
  );
}
