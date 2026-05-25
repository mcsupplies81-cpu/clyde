export type Load = { id: string; lane: string; status: 'new' | 'quoted' | 'booked' };

export const demoLoads: Load[] = [
  { id: 'L-1001', lane: 'Dallas, TX → Atlanta, GA', status: 'new' },
  { id: 'L-1002', lane: 'Chicago, IL → Phoenix, AZ', status: 'quoted' }
];

export function classifyEmailMock(email: string): string {
  return email.toLowerCase().includes('rate') ? 'Quote request' : 'General inquiry';
}

export function generateDraftMock(topic: string): string {
  return `Thanks for reaching out about ${topic}. We can support this lane and will follow up with pricing shortly.`;
}
