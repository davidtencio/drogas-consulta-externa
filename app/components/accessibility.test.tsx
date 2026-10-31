import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { AccessibleDialog } from "./AccessibleDialog";
import { InventoryDetail } from "./InventoryDetail";

const medicine = { id: "m1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades", stock: 50, minimumStock: 10, lot: "L1", expiresAt: "2099-01-01", active: true };

describe("regresiones automáticas de accesibilidad", () => {
  it("no detecta infracciones axe en el detalle de inventario", async () => {
    const { container } = render(
      <InventoryDetail
        medicine={medicine}
        certification={{ createdAt: "2026-07-20T12:00:00.000Z", pharmacistName: "Ana Rojas" }}
        onClose={vi.fn()}
        onMovement={vi.fn()}
        onCount={vi.fn()}
        onViewMovements={vi.fn()}
      />
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("no detecta infracciones axe en el diálogo base", async () => {
    const { container } = render(<AccessibleDialog title="Confirmación" description="Revise los datos" onClose={vi.fn()}><button>Cancelar</button><button>Confirmar</button></AccessibleDialog>);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
