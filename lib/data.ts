import { demoLoads } from './mock';
import { getDatabaseUrl } from './env';

export function getLoads() {
  getDatabaseUrl();
  return demoLoads;
}
