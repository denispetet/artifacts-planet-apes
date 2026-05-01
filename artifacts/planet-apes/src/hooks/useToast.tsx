import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

export interface ToastMessage {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

interface ToastCtx {
  toasts: ToastMessage[];
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastCtx>({ toasts: [], showToast: () => {} });

let _idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = ++_idCounter;
    setToasts((prev) => [...prev, { id, msg, type }]);
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 4000);
    timers.current.set(id, t);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
