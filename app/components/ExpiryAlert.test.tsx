import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpiryAlert, expiryAlertMessage } from "./ExpiryAlert";

describe("expiryAlertMessage", () => {
  it("combina vencidos y por vencer", () => {
    expect(expiryAlertMessage({ expired: 2, soon: 3 })).toBe("2 con lotes vencidos y 3 con lotes por vencer");
  });
  it("solo vencidos, en singular", () => {
    expect(expiryAlertMessage({ expired: 1, soon: 0 })).toBe("1 medicamento con lotes vencidos");
  });
  it("solo vencidos, en plural", () => {
    expect(expiryAlertMessage({ expired: 4, soon: 0 })).toBe("4 medicamentos con lotes vencidos");
  });
  it("solo por vencer", () => {
    expect(expiryAlertMessage({ expired: 0, soon: 1 })).toBe("1 medicamento con lotes por vencer");
  });
});

describe("ExpiryAlert", () => {
  const noop = () => {};

  it("no renderiza nada cuando no hay vencidos ni por vencer", () => {
    const { container } = render(
      <ExpiryAlert summary={{ expired: 0, soon: 0 }} showViewButton={false} onView={noop} onDismiss={noop} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el mensaje y marca peligro cuando hay vencidos", () => {
    const { container } = render(
      <ExpiryAlert summary={{ expired: 2, soon: 1 }} showViewButton={false} onView={noop} onDismiss={noop} />
    );
    expect(screen.getByText("2 con lotes vencidos y 1 con lotes por vencer")).toBeInTheDocument();
    expect(container.querySelector(".expiry-alert.danger")).not.toBeNull();
  });

  it("sin vencidos no marca peligro", () => {
    const { container } = render(
      <ExpiryAlert summary={{ expired: 0, soon: 3 }} showViewButton={false} onView={noop} onDismiss={noop} />
    );
    expect(container.querySelector(".expiry-alert.danger")).toBeNull();
  });

  it("llama onDismiss al descartar", async () => {
    const onDismiss = vi.fn();
    render(<ExpiryAlert summary={{ expired: 1, soon: 0 }} showViewButton={false} onView={noop} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByLabelText("Descartar aviso"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("muestra 'Ver inventario' solo cuando corresponde", async () => {
    const onView = vi.fn();
    const { rerender } = render(
      <ExpiryAlert summary={{ expired: 1, soon: 0 }} showViewButton={false} onView={onView} onDismiss={noop} />
    );
    expect(screen.queryByText("Ver inventario")).not.toBeInTheDocument();
    rerender(<ExpiryAlert summary={{ expired: 1, soon: 0 }} showViewButton onView={onView} onDismiss={noop} />);
    await userEvent.click(screen.getByText("Ver inventario"));
    expect(onView).toHaveBeenCalledOnce();
  });
});
