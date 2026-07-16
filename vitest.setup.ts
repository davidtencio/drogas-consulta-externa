// Matchers de jest-dom (toBeInTheDocument, toBeDisabled, …) y limpieza del DOM
// entre tests.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
