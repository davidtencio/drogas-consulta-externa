"use client";

import React from "react";
import { recordOperationalEvent } from "../lib/db";

type State = { failed: boolean };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void recordOperationalEvent("ui.unhandled_error", {
      message: error.message.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 2000) ?? "",
      path: window.location.pathname,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error-card">
          <span className="fatal-error-icon" aria-hidden="true">!</span>
          <h1>No pudimos mostrar esta pantalla</h1>
          <p>El incidente quedó registrado. Recargue la aplicación para continuar.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      </main>
    );
  }
}
