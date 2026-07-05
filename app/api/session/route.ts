import { prisma } from "@/lib/prisma";
import { emptyBodySchema, getValidationErrorMessage } from "@/lib/validation";

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

  const parsed = emptyBodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        subscription: {
          create: {
            status: "free",
          },
        },
      },
      select: {
        id: true,
      },
    });

    return Response.json({ userId: user.id }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create session." }, { status: 500 });
  }
}
