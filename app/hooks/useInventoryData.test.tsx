import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { snapshot, unsubscribe } = vi.hoisted(() => ({ snapshot: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../lib/demo", async (original) => ({ ...await original<typeof import("../lib/demo")>(), DEMO_MODE: false }));
vi.mock("firebase/firestore", () => ({ collection: (_db: unknown, name: string) => ({ name }), query: (ref: unknown) => ref, orderBy: vi.fn(), limit: vi.fn(), onSnapshot: snapshot }));
import { useInventoryData } from "./useInventoryData";

type Response = { docs: { id: string; data: () => object }[]; metadata: { hasPendingWrites: boolean } };
let received: (response: Response) => void;
let failed: () => void;
const nextByCollection: Record<string, (response: Response) => void> = {};
const errorByCollection: Record<string, () => void> = {};
beforeEach(() => {
  snapshot.mockReset(); unsubscribe.mockClear();
  snapshot.mockImplementation((ref, _options, onNext, onError) => {
    nextByCollection[ref.name] = onNext;
    errorByCollection[ref.name] = onError;
    if (ref.name === "medicines") { received = onNext; failed = onError; }
    return unsubscribe;
  });
});

describe("consulta del inventario", () => {
  it("distingue el error de un catálogo vacío y restablece la consulta al reintentar", () => {
    const { result } = renderHook(() => useInventoryData(true));
    expect(result.current.loading).toBe(true);
    act(() => failed());
    expect(result.current.loading).toBe(false);
    expect(result.current.inventoryError).toMatch(/No se pudo obtener/);
    expect(result.current.medicines).toEqual([]);
    act(() => result.current.retryInventory());
    expect(unsubscribe).toHaveBeenCalled();
    expect(result.current.inventoryError).toBeNull();
    expect(result.current.loading).toBe(true);
    act(() => received({ docs: [], metadata: { hasPendingWrites: false } }));
    expect(result.current.loading).toBe(false);
    expect(result.current.inventoryError).toBeNull();
  });
  it("retira los datos anteriores si la suscripción falla", () => {
    const { result } = renderHook(() => useInventoryData(true));
    act(() => received({ docs: [{ id: "a", data: () => ({ name: "DEMO", stock: 20 }) }], metadata: { hasPendingWrites: false } }));
    expect(result.current.medicines).toHaveLength(1);
    act(() => failed());
    expect(result.current.medicines).toEqual([]);
    expect(result.current.inventoryError).not.toBeNull();
  });

  it("espera cada colección y distingue errores de historial y personal", () => {
    const { result } = renderHook(() => useInventoryData(true));
    const empty = { docs: [], metadata: { hasPendingWrites: false } };
    act(() => received(empty));
    expect(result.current.loading).toBe(false);
    expect(result.current.movementsLoading).toBe(true);
    expect(result.current.settingsLoading).toBe(true);
    act(() => errorByCollection.movements());
    expect(result.current.movementsLoading).toBe(false);
    expect(result.current.movementsError).toMatch(/historial reciente/);
    act(() => errorByCollection.pharmacists());
    expect(result.current.settingsLoading).toBe(false);
    expect(result.current.settingsError).toMatch(/personal autorizado/);
    act(() => { nextByCollection.movements(empty); nextByCollection.pharmacists(empty); });
    expect(result.current.movementsError).toBeNull();
    expect(result.current.settingsError).toBeNull();
  });
});
