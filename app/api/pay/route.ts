import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage, paySchema } from "@/lib/validation";

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = paySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: parsed.data.userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const subscription = await prisma.subscription.upsert({
      where: {
        userId: user.id,
      },
      update: {
        status: "active",
        paidAt: new Date(),
      },
      create: {
        userId: user.id,
        status: "active",
        paidAt: new Date(),
      },
      select: {
        status: true,
      },
    });

    return Response.json({ status: subscription.status });
  } catch {
    return Response.json({ error: "Failed to process payment." }, { status: 500 });
  }
}
