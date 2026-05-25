import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { getLoads } from '@/lib/data';

export default function LoadsPage() {
  try {
    const loads = getLoads();
    return <main className="container"><h1>Loads</h1><Nav />{loads.map((l) => <div className="card" key={l.id}><Link href={`/app/loads/${l.id}`}>{l.id}</Link> — {l.lane} ({l.status})</div>)}</main>;
  } catch (error) {
    return <main className="container"><h1>Loads</h1><Nav /><div className="error">{(error as Error).message}</div></main>;
  }
}
