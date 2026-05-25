import { saveLoadMatchClassification } from '@/lib/ai-classifications';
import { matchEmailToLoad, type EmailMessage, type Load } from '@/lib/load-matching';

export async function POST(request: Request, { params }: { params: { messageId: string } }) {
  const payload = (await request.json()) as {
    emailMessage: EmailMessage;
    loads: Load[];
  };

  const result = matchEmailToLoad(payload.emailMessage, payload.loads);
  const classification = await saveLoadMatchClassification(params.messageId, result);

  return Response.json({ result, classification });
}
