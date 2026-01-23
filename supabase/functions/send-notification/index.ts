import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "status_change" | "priority_change" | "admin_comment";
  complaintId: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, complaintId, oldValue, newValue, comment }: NotificationRequest = await req.json();

    // Fetch complaint details
    const { data: complaint, error: complaintError } = await supabase
      .from("complaints")
      .select("id, subject, status, priority, user_id")
      .eq("id", complaintId)
      .single();

    if (complaintError || !complaint) {
      console.error("Error fetching complaint:", complaintError);
      return new Response(
        JSON.stringify({ error: "Complaint not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch user profile separately
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", complaint.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const studentEmail = profile.email;
    const studentName = profile.full_name;

    let emailSubject = "";
    let htmlContent = "";

    const priorityColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#eab308",
      high: "#f97316",
      critical: "#ef4444",
    };

    const statusLabels: Record<string, string> = {
      submitted: "Submitted",
      in_review: "In Review",
      resolved: "Resolved",
    };

    switch (type) {
      case "status_change":
        emailSubject = `Complaint Status Updated: ${complaint.subject}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Hello ${studentName},</h2>
            <p>Your complaint status has been updated.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">Complaint: ${complaint.subject}</h3>
              <p style="margin: 5px 0;"><strong>Previous Status:</strong> ${statusLabels[oldValue || ""] || oldValue}</p>
              <p style="margin: 5px 0;"><strong>New Status:</strong> <span style="color: #2563eb; font-weight: bold;">${statusLabels[newValue || ""] || newValue}</span></p>
            </div>
            <p>Log in to your dashboard to view more details.</p>
            <p style="color: #6b7280; margin-top: 30px;">Best regards,<br>The Complaint Management Team</p>
          </div>
        `;
        break;

      case "priority_change":
        emailSubject = `Complaint Priority Updated: ${complaint.subject}`;
        const newPriorityColor = priorityColors[newValue || "medium"] || "#6b7280";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Hello ${studentName},</h2>
            <p>The priority level of your complaint has been updated.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">Complaint: ${complaint.subject}</h3>
              <p style="margin: 5px 0;"><strong>Previous Priority:</strong> ${(oldValue || "").charAt(0).toUpperCase() + (oldValue || "").slice(1)}</p>
              <p style="margin: 5px 0;"><strong>New Priority:</strong> <span style="color: ${newPriorityColor}; font-weight: bold;">${(newValue || "").charAt(0).toUpperCase() + (newValue || "").slice(1)}</span></p>
            </div>
            <p>Log in to your dashboard to view more details.</p>
            <p style="color: #6b7280; margin-top: 30px;">Best regards,<br>The Complaint Management Team</p>
          </div>
        `;
        break;

      case "admin_comment":
        emailSubject = `New Response on Your Complaint: ${complaint.subject}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Hello ${studentName},</h2>
            <p>An administrator has responded to your complaint.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">Complaint: ${complaint.subject}</h3>
              <div style="background: white; padding: 15px; border-left: 4px solid #2563eb; margin-top: 15px;">
                <p style="margin: 0; color: #374151;">${comment}</p>
              </div>
            </div>
            <p>Log in to your dashboard to view the full conversation and respond.</p>
            <p style="color: #6b7280; margin-top: 30px;">Best regards,<br>The Complaint Management Team</p>
          </div>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid notification type" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Complaint System <onboarding@resend.dev>",
        to: [studentEmail],
        subject: emailSubject,
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Error sending email:", emailResult);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailResult }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResponse: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
