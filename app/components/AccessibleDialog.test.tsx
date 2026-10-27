import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessibleDialog } from "./AccessibleDialog";

describe("AccessibleDialog", () => {
  it("expone semántica modal y enfoca el control inicial", () => {
    render(<AccessibleDialog title="Prueba" description="Descripción" onClose={vi.fn()}><button data-autofocus>Cancelar</button><button>Aceptar</button></AccessibleDialog>);
    expect(screen.getByRole("dialog", { name: "Prueba" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("cierra con Escape", async () => {
    const onClose = vi.fn();
    render(<AccessibleDialog title="Prueba" onClose={onClose}><button>Aceptar</button></AccessibleDialog>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("mantiene Tab dentro del diálogo", async () => {
    render(<AccessibleDialog title="Prueba" onClose={vi.fn()}><button data-autofocus>Primero</button><button>Último</button></AccessibleDialog>);
    screen.getByRole("button", { name: "Cerrar" }).focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
  });

  it("conserva el foco al actualizar el diálogo y restaura el fondo al cerrarlo", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Abrir";
    document.body.append(trigger);
    trigger.focus();
    const originalOverflow = document.body.style.overflow;
    const latestClose = vi.fn();
    const { rerender, unmount } = render(<AccessibleDialog title="Prueba" onClose={vi.fn()}><input aria-label="Dato" /><button>Aceptar</button></AccessibleDialog>);
    const input = screen.getByLabelText("Dato");
    input.focus();
    rerender(<AccessibleDialog title="Prueba actualizada" onClose={latestClose}><input aria-label="Dato" /><button>Aceptar</button></AccessibleDialog>);
    expect(input).toHaveFocus();
    expect(trigger.inert).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(latestClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger.inert).not.toBe(true);
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe(originalOverflow);
    trigger.remove();
  });
});
