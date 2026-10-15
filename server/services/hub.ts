import type { Response } from 'express';

// Keeps the open browser connections and pushes events to all of them.
const clients = new Set<Response>();

export const hub = {
  add(res: Response) {
    clients.add(res);
  },
  remove(res: Response) {
    clients.delete(res);
  },
  size() {
    return clients.size;
  },
  broadcast(event: string, data: unknown) {
    if (clients.size === 0) return;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(msg);
  },
  closeAll() {
    for (const c of clients) c.end();
    clients.clear();
  },
};
