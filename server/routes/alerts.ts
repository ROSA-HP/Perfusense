import { Router } from 'express';
import { z } from 'zod';
import { AuditLog } from '../models';
import { ApiError, asyncHandler, parse } from '../lib/errors';
import { auditItem } from '../services/derive';
import { hub } from '../services/hub';

export const alertsRouter = Router();

const SITE_TO_CATEGORY: Record<string, string> = { sacral: 'Sacrum', troch: 'Trochanter', heels: 'Heels' };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter(q: Record<string, unknown>) {
  const filter: Record<string, any> = {};
  if (typeof q.bedId === 'string') filter.bedId = q.bedId;
  if (q.status === 'ACTIVE' || q.status === 'RESOLVED') filter.status = q.status;

  const and: any[] = [];
  const site = typeof q.site === 'string' ? SITE_TO_CATEGORY[q.site] : undefined;
  if (site) and.push({ zoneCategory: site });

  // Same behaviour as the UI's dropdown: a category name, or a piece of the zone text.
  if (typeof q.zone === 'string' && q.zone !== 'ALL') {
    const rx = new RegExp(escape(q.zone), 'i');
    and.push({ $or: [{ zoneCategory: rx }, { zoneLocus: rx }] });
  }
  if (typeof q.q === 'string' && q.q.trim()) {
    const rx = new RegExp(escape(q.q.trim()), 'i');
    and.push({ $or: [{ patientName: rx }, { bedUnit: rx }, { attendingRn: rx }, { patientId: rx }] });
  }
  if (and.length) filter.$and = and;
  return filter;
}

// GET /api/audit-logs?site=sacral&zone=Heels&q=berg&status=ACTIVE&page=1&pageSize=10
// Without "page" it returns a plain array (what the current UI expects).
alertsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query);
    const now = new Date();
    if (req.query.page === undefined) {
      const docs = await AuditLog.find(filter).sort({ at: -1 }).limit(1000).lean();
      return res.json(docs.map((d) => auditItem(d, now)));
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const [docs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ items: docs.map((d) => auditItem(d, now)), total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
  }),
);

// GET /api/audit-logs/export.csv?bedId=bed-07
alertsRouter.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const docs = await AuditLog.find(buildFilter(req.query)).sort({ at: -1 }).limit(5000).lean();
    const cell = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
      return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ['Timestamp', 'Bed', 'PatientId', 'Patient', 'Zone', 'Category', 'PeakMmHg', 'DwellMin', 'Action', 'RN', 'Status'];
    const rows = docs.map((d: any) =>
      [new Date(d.at).toISOString(), d.bedUnit, d.patientId, d.patientName, d.zoneLocus, d.zoneCategory, d.peakMmHg, d.dwellMin, d.actionTaken, d.attendingRn, d.status]
        .map(cell)
        .join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="perfusense_audit.csv"');
    res.send([head.join(','), ...rows].join('\n'));
  }),
);

alertsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await AuditLog.findOne({ id: req.params.id }).lean();
    if (!doc) throw new ApiError(404, 'Unknown audit log entry');
    res.json(auditItem(doc, new Date()));
  }),
);

// Acknowledge an escalation. The re-alert timer restarts (default 15 minutes).
alertsRouter.post(
  '/:id/acknowledge',
  asyncHandler(async (req, res) => {
    const { rn, reAlertMin } = parse(
      z.object({ rn: z.string().min(1).max(120), reAlertMin: z.number().min(1).max(120).default(15) }),
      req.body,
    );
    const now = new Date();
    const doc = await AuditLog.findOneAndUpdate(
      { id: req.params.id },
      { $set: { acknowledgedAt: now, acknowledgedBy: rn, reAlertAt: new Date(now.getTime() + reAlertMin * 60000) } },
      { new: true },
    ).lean();
    if (!doc) throw new ApiError(404, 'Unknown audit log entry');
    const item = auditItem(doc, now);
    hub.broadcast('alert', item);
    res.json(item);
  }),
);

alertsRouter.post(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const { action, rn } = parse(
      z.object({ action: z.string().min(1).max(500), rn: z.string().min(1).max(120) }),
      req.body,
    );
    const doc = await AuditLog.findOneAndUpdate(
      { id: req.params.id },
      { $set: { status: 'RESOLVED', actionTaken: action, attendingRn: rn } },
      { new: true },
    ).lean();
    if (!doc) throw new ApiError(404, 'Unknown audit log entry');
    const item = auditItem(doc, new Date());
    hub.broadcast('alert', item);
    res.json(item);
  }),
);
