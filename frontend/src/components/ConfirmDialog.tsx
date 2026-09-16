import { useEffect, useId, useState, type ReactNode } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  // when set, the dialog offers an optional note that rides along with the confirm
  messageLabel?: string
  messagePlaceholder?: string
  busy?: boolean
  error?: string | null
  onConfirm: (message: string | null) => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  messageLabel,
  messagePlaceholder,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [message, setMessage] = useState('')
  const messageId = useId()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {body && <div className="dialog-body">{body}</div>}

        {messageLabel && (
          <label htmlFor={messageId}>
            {messageLabel}
            <textarea
              id={messageId}
              rows={3}
              placeholder={messagePlaceholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
        )}

        {error && <p className="auth-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="dialog-cancel" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'button button-danger' : 'button'}
            disabled={busy}
            onClick={() => onConfirm(message.trim() || null)}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
