import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('shows the title and body', () => {
    render(
      <ConfirmDialog
        title="Delete this mission?"
        body="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('Delete this mission?')
    expect(screen.getByRole('dialog')).toHaveTextContent('This cannot be undone.')
  })

  it('confirms with no message when there is no note field', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('uses a custom confirm label', () => {
    render(
      <ConfirmDialog title="Sure?" confirmLabel="Publish" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Sure?" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('passes along a note when one is offered and typed', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="Assign Pete?"
        messageLabel="Message to the pilot"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText('Message to the pilot'), 'Wheels up at 7')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith('Wheels up at 7')
  })

  it('sends null rather than an empty note', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="Assign Pete?"
        messageLabel="Message to the pilot"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('shows an error and keeps the dialog usable', () => {
    render(
      <ConfirmDialog title="Sure?" error="Could not delete" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('Could not delete')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  })

  it('disables the buttons while busy', () => {
    render(<ConfirmDialog title="Sure?" busy onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('cancels on escape', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />)

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
  })
})
