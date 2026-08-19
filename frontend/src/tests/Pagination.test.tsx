import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from '@/components/ui/Pagination'

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} total={5} limit={10} onPage={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the correct range summary', () => {
    render(<Pagination page={2} total={42} limit={10} onPage={vi.fn()} />)
    expect(screen.getByText('11–20 of 42')).toBeInTheDocument()
  })

  it('caps the end of the range at the total', () => {
    render(<Pagination page={5} total={42} limit={10} onPage={vi.fn()} />)
    expect(screen.getByText('41–42 of 42')).toBeInTheDocument()
  })

  it('disables prev on the first page and next on the last', () => {
    const { rerender } = render(<Pagination page={1} total={30} limit={10} onPage={vi.fn()} />)
    expect(screen.getByText('chevron_left').closest('button')).toBeDisabled()
    expect(screen.getByText('chevron_right').closest('button')).not.toBeDisabled()

    rerender(<Pagination page={3} total={30} limit={10} onPage={vi.fn()} />)
    expect(screen.getByText('chevron_left').closest('button')).not.toBeDisabled()
    expect(screen.getByText('chevron_right').closest('button')).toBeDisabled()
  })

  it('calls onPage with the clicked page number', async () => {
    const onPage = vi.fn()
    render(<Pagination page={1} total={30} limit={10} onPage={onPage} />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPage).toHaveBeenCalledWith(3)
  })

  it('windows page numbers around the current page for many pages', () => {
    render(<Pagination page={10} total={200} limit={10} onPage={vi.fn()} />)
    for (const p of ['8', '9', '10', '11', '12']) {
      expect(screen.getByRole('button', { name: p })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })
})
