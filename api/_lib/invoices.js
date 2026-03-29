// Shared invoice generation logic — used by cron-invoices.js and admin manual trigger.

export async function generateWeeklyInvoices(sb, { weekStart, weekEnd }) {
  const errors = [];

  // 1. Fetch all pending payouts in the date range, grouped by driver
  const { data: payouts, error: fetchErr } = await sb
    .from('payouts')
    .select('id, job_id, driver_id, gross_gbp, platform_fee_gbp, net_gbp, created_at, jobs(pickup_postcode, destination_postcode, move_date)')
    .eq('status', 'pending')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)
    .order('created_at', { ascending: true });

  if (fetchErr) throw new Error(`Failed to fetch payouts: ${fetchErr.message}`);
  if (!payouts || payouts.length === 0) return { invoicesCreated: 0, errors };

  // Group by driver
  const byDriver = {};
  for (const p of payouts) {
    if (!byDriver[p.driver_id]) byDriver[p.driver_id] = [];
    byDriver[p.driver_id].push(p);
  }

  // 2. Get next invoice number
  const { data: lastInvoice } = await sb
    .from('invoices')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1;
  if (lastInvoice?.invoice_number) {
    const match = lastInvoice.invoice_number.match(/INV-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  const year = new Date().getFullYear();
  let invoicesCreated = 0;

  // 3. Create invoice per driver
  for (const [driverId, driverPayouts] of Object.entries(byDriver)) {
    try {
      const invoiceNumber = `INV-${year}-${String(seq).padStart(4, '0')}`;
      seq++;

      const gross = driverPayouts.reduce((s, p) => s + Number(p.gross_gbp), 0);
      const fees  = driverPayouts.reduce((s, p) => s + Number(p.platform_fee_gbp), 0);
      const net   = driverPayouts.reduce((s, p) => s + Number(p.net_gbp), 0);

      // Insert invoice
      const { data: invoice, error: invErr } = await sb
        .from('invoices')
        .insert({
          driver_id:        driverId,
          invoice_number:   invoiceNumber,
          week_start:       weekStart.slice(0, 10),
          week_end:         weekEnd.slice(0, 10),
          job_count:        driverPayouts.length,
          gross_gbp:        parseFloat(gross.toFixed(2)),
          platform_fee_gbp: parseFloat(fees.toFixed(2)),
          net_gbp:          parseFloat(net.toFixed(2)),
          status:           'issued',
          issued_at:        new Date().toISOString(),
        })
        .select('id')
        .single();

      if (invErr) { errors.push(`Invoice for driver ${driverId}: ${invErr.message}`); continue; }

      // Insert line items
      const lines = driverPayouts.map(p => {
        const pickup = p.jobs?.pickup_postcode || '?';
        const dest   = p.jobs?.destination_postcode || '?';
        const date   = p.jobs?.move_date
          ? new Date(p.jobs.move_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : '';
        return {
          invoice_id: invoice.id,
          payout_id:  p.id,
          job_id:     p.job_id,
          move_date:  p.jobs?.move_date || null,
          description: `${pickup} → ${dest}${date ? ` (${date})` : ''}`,
          gross_gbp:  Number(p.gross_gbp),
          fee_gbp:    Number(p.platform_fee_gbp),
          net_gbp:    Number(p.net_gbp),
        };
      });

      await sb.from('invoice_lines').insert(lines);

      // Update payouts → invoiced
      const payoutIds = driverPayouts.map(p => p.id);
      await sb
        .from('payouts')
        .update({ status: 'invoiced', invoice_id: invoice.id })
        .in('id', payoutIds);

      // Log events
      const events = driverPayouts.map(p => ({
        job_id:     p.job_id,
        event_type: 'driver_invoiced',
        payload:    { invoice_id: invoice.id, invoice_number: invoiceNumber, net_gbp: Number(p.net_gbp) },
        created_by: 'system',
      }));
      await sb.from('job_events').insert(events);

      invoicesCreated++;
    } catch (err) {
      errors.push(`Driver ${driverId}: ${err.message}`);
    }
  }

  return { invoicesCreated, errors };
}
