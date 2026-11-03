import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import {
  getActivityRow,
  getItemRow,
  resolveItemActivity,
} from "@/app/actions/admin-content-hub";
import {
  setReadingTimer,
  setSelectionTimer,
  expireSelections,
  ProjectFormStatus,
} from "@/app/actions/admin-problem-statements";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    await requireAdmin();
    const { activityId } = await params;

    const { row: activityRow } = await getActivityRow(activityId);
    const { activity, marker } = await resolveItemActivity(activityRow);

    if (activity.type !== "problem_statements") {
      return NextResponse.json(
        { error: "Activity is not a problem statement activity" },
        { status: 400 }
      );
    }

    // Read current timer state from the activity record
    return NextResponse.json({
      activityId,
      title: activity.title,
      // Reading timer
      readingTimerEndTime: activityRow.timer_end_time,
      readingTimerAutoPublish: activityRow.timer_auto_publish ?? true,
      readingTimerTimezone: activityRow.timer_timezone ?? "UTC",
      // Selection timer
      selectionOpening: activityRow.selection_opening,
      selectionClosing: activityRow.selection_closing,
      selectionEnabled: activityRow.enable_selection ?? true,
      manualLock: activityRow.manual_lock ?? false,
      status: activityRow.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    await requireAdmin();
    const { activityId } = await params;
    const body = await req.json();
    const { type, ...timerData } = body;
    const csrfToken = body[CSRF_CONSTANTS.HEADER_NAME];

    await validateCsrfToken(csrfToken || null);

    if (type === "reading") {
      const { scheduledAt, autoPublish } = timerData as {
        scheduledAt: string;
        autoPublish: boolean;
      };
      const result = await setReadingTimer(
        activityId,
        scheduledAt,
        autoPublish,
        csrfToken
      );
      return NextResponse.json(result);
    } else if (type === "selection") {
      const { selectionOpening, selectionClosing } = timerData as {
        selectionOpening: string | null;
        selectionClosing: string | null;
      };
      const result = await setSelectionTimer(
        activityId,
        selectionOpening,
        selectionClosing,
        csrfToken
      );
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Invalid timer type. Use 'reading' or 'selection'." },
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    await requireAdmin();
    const { activityId } = await params;
    const body = await req.json();
    const { action, ...timerData } = body;
    const csrfToken = body[CSRF_CONSTANTS.HEADER_NAME];

    await validateCsrfToken(csrfToken || null);

    if (action === "expireSelections") {
      const result = await expireSelections(activityId, csrfToken);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'expireSelections'." },
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
