import { statusColors } from './styles.js';

const labels = {
  pending_payment:    'Pending Payment',
  pending_acceptance: 'Pending Acceptance',
  accepted:           'Accepted',
  in_progress:        'In Progress',
  completed:          'Completed',
  cancelled:          'Cancelled',
  refunded:           'Refunded',
  pending:            'Pending',
  transferred:        'Transferred',
  failed:             'Failed',
};

export default function StatusBadge({ status }) {
  const bg = statusColors[status] || '#555';
  return (
    <span style={{
      display: 'inline-block',
      background: `${bg}22`,
      color: bg,
      fontSize: '0.75rem',
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {labels[status] || status}
    </span>
  );
}
