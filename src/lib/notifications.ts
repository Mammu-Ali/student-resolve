import { supabase } from "@/integrations/supabase/client";

type NotificationType = "status_change" | "priority_change" | "admin_comment";

interface SendNotificationParams {
  type: NotificationType;
  complaintId: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
}

export async function sendNotification(params: SendNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: params,
    });

    if (error) {
      console.error("Failed to send notification:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: (error as Error).message };
  }
}
