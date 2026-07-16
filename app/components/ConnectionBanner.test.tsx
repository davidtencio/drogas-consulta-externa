import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionBanner } from "./ConnectionBanner";

describe("ConnectionBanner", () => {
  it("no muestra nada cuando hay conexión y no hay pendientes", () => {
    const { container } = render(<ConnectionBanner online={true} pendingWrites={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("avisa cuando no hay conexión", () => {
    render(<ConnectionBanner online={false} pendingWrites={false} />);
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
    expect(screen.getByText(/se guardarán y sincronizarán al reconectar/)).toBeInTheDocument();
  });

  it("prioriza el aviso de sin conexión aunque haya pendientes", () => {
    render(<ConnectionBanner online={false} pendingWrites={true} />);
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
    expect(screen.queryByText(/Sincronizando/)).not.toBeInTheDocument();
  });

  it("muestra sincronizando cuando hay conexión y pendientes", () => {
    render(<ConnectionBanner online={true} pendingWrites={true} />);
    expect(screen.getByText("Sincronizando cambios…")).toBeInTheDocument();
  });
});
