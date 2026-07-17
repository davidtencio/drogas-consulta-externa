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
});
