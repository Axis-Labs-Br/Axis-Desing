import { useCallback, useRef, useState } from 'react';
import type { DesignDocument } from './model';

export function useHistory(initial: DesignDocument) {
  const [doc, setDoc] = useState(initial);
  const current = useRef(initial);
  const past = useRef<DesignDocument[]>([]);
  const future = useRef<DesignDocument[]>([]);
  const [, revision] = useState(0);
  const update = useCallback((updater: (d: DesignDocument) => DesignDocument, commit = true) => {
    const next = updater(current.current);
    if (next === current.current) return;
    if (commit) {
      past.current = [...past.current.slice(-79), structuredClone(current.current)];
      future.current = [];
    }
    current.current = { ...next, updatedAt: Date.now() };
    setDoc(current.current);
    revision((n) => n + 1);
  }, []);
  const checkpoint = useCallback(() => {
    past.current = [...past.current.slice(-79), structuredClone(current.current)];
    future.current = [];
    revision((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    current.current = { ...prev, updatedAt: Date.now() };
    setDoc(current.current);
    revision((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    current.current = { ...next, updatedAt: Date.now() };
    setDoc(current.current);
    revision((n) => n + 1);
  }, []);
  return {
    doc,
    update,
    checkpoint,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    current,
  };
}
