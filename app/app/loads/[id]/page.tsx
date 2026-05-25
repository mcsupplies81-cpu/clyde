import { Nav } from '@/components/Nav';
import { demoLoads } from '@/lib/mock';
import { getDatabaseUrl } from '@/lib/env';

export default function LoadDetailPage({ params }: { params: { id: string } }) {
  try {
    getDatabaseUrl();
    const load = demoLoads.find((l) => l.id === params.id);
    if (!load) return <main className="container"><h1>Load not found</h1><Nav /></main>;
    return <main className="container"><h1>{load.id}</h1><Nav /><div className="card">{load.lane} ({load.status})</div></main>;
  } catch (error) {
    return <main className="container"><h1>Load detail</h1><Nav /><div className="error">{(error as Error).message}</div></main>;
  }
}
