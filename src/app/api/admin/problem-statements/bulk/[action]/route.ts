import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import {
  bulkPublishProblemStatements,
  bulkUnpublishProblemStatements,
  bulkAllowSelection,
  bulkDisableSelection,
  bulkCloseSelection,
} from "@/app/actions/admin-problem-statements";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    await requireAdmin();
    const { action } = await params;
    const body = await req.json();
    const { activityId, ...rest } = body;
    const csrfToken = body[CSRF_CONSTANTS.HEADER_NAME];

    await validateCsrfToken(csrfToken || null);

    if (!activityId) {
      return NextResponse.json(
        { error: "Missing activityId" },
        { status: 400 }
      );
    }

    switch (action) {
      case "publish":
        const publishResult = await bulkPublishProblemStatements(
          activityId,
          csrfToken
        );
        return NextResponse.json(publishResult);

      case "unpublish":
        const unpublishResult = await bulkUnpublishProblemStatements(
          activityId,
          csrfToken
        );
        return NextResponse.json(unpublishResult);

      case "allow-selection":
        const allowResult = await bulkAllowSelection(
          activityId,
          csrfToken
        );
        return NextResponse.json(allowResult);

      case "disable-selection":
        const disableResult = await bulkDisableSelection(
          activityId,
          csrfToken
        );
        return NextResponse.json(disableResult);

      case "close-selection":
        const closeResult = await bulkCloseSelection(
          activityId,
          csrfToken
        );
        return NextResponse.json(closeResult);

      default:
        return NextResponse.json(
          { error: `Unknown bulk action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
