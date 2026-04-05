import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const [timerId, setTimerId] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    if (timerId) clearTimeout(timerId)
    setToast({ message, type })
    const id = setTimeout(() => setToast(null), 2800)
    setTimerId(id)
  }, [timerId])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : toast.type === 'warning' ? '😊' : 'ℹ️'}
          </span>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
