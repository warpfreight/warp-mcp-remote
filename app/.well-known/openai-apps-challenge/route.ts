export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Domain proof supplied by the account owner during app submission.
// Stay unavailable until a real challenge is configured; never cache tokens.
export async function GET() {
  const challenge = process.env.OPENAI_APPS_CHALLENGE;
  return new Response(challenge || null, {
    status: challenge ? 200 : 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
