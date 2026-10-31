import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Department } from "@/lib/types";

let cache: Department[] | null = null;
let inflight: Promise<Department[]> | null = null;
const listeners = new Set<(d: Department[]) => void>();

function publish(departments: Department[]) {
  cache = departments;
  listeners.forEach((fn) => fn(departments));
}

export function loadDepartments(): Promise<Department[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .departments()
      .then((departments) => {
        publish(departments);
        inflight = null;
        return departments;
      })
      .catch((error) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>(cache ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    listeners.add(setDepartments);
    if (!cache) {
      setLoading(true);
      loadDepartments()
        .then(() => {
          if (alive) {
            setLoading(false);
            setError(null);
          }
        })
        .catch((err: Error) => {
          if (alive) {
            setLoading(false);
            setError(err.message || "Could not load departments.");
          }
        });
    }
    return () => {
      alive = false;
      listeners.delete(setDepartments);
    };
  }, []);

  return { departments, loading, error };
}
