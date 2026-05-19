import { useState, type Dispatch, type SetStateAction } from "react";

/** Keeps local state in sync when a prop identity key changes (avoids setState in useEffect). */
export function useSyncPropState<T>(value: T, syncKey: string): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);
  const [prevKey, setPrevKey] = useState(syncKey);

  if (syncKey !== prevKey) {
    setPrevKey(syncKey);
    setState(value);
  }

  return [state, setState];
}
