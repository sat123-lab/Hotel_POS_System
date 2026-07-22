/** Customer-facing order number — per branch sequence (1, 2, 3…). */

export const getOrderDisplayNumber = (order) => {
  if (order == null) return '';
  if (typeof order === 'number') return order;
  const branchNum = order.branch_order_number ?? order.branchOrderNumber;
  if (branchNum != null && branchNum !== '') return branchNum;
  return order.id ?? '';
};

export const formatOrderNumber = (order, prefix = '#') =>
  `${prefix}${getOrderDisplayNumber(order)}`;

export const formatOrderLabel = (order, prefix = 'Order') =>
  `${prefix} #${getOrderDisplayNumber(order)}`;

/** Human-readable "time ago" — min / hours / days / date instead of raw minutes. */
export const formatRelativeTime = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) {
    const mins = diffMin % 60;
    return mins > 0 ? `${diffHr}h ${mins}m ago` : `${diffHr}h ago`;
  }
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};
