import type { IncomingMessage } from 'http';
import { getClientIp } from './utils';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const ipMap = new Map<string, number[]>();

export function rateLimit(req: IncomingMessage) {
  const ip = getClientIp(req);
  const now = Date.now();
  const timestamps = ipMap.get(ip) ?? [];
  const filtered = timestamps.filter((ts) => ts > now - WINDOW_MS);
  filtered.push(now);
  ipMap.set(ip, filtered);

  if (filtered.length > MAX_REQUESTS) {
    const retryAfter = Math.ceil((filtered[0] + WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau vài giây.',
      retryAfter,
    };
  }
  return { allowed: true };
}
