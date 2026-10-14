import { requireAdmin } from "@/lib/apiAuth";
import { runAgent, sanitizeMessages } from "@/lib/cofounderAgent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// requireAdmin rejects anyone who isn't a logged-in admin before this runs.
export const POST = requireAdmin(async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages = sanitizeMessages(body?.messages);
  if (messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  try {
    const { finalText, proposals } = await runAgent({
      messages,
      voice: !!body.voice,
      lang: body.lang,
    });
    return Response.json({
      reply: finalText || "I couldn't come up with an answer. Please try again.",
      proposals,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Agent failed" }, { status: 500 });
  }
});