import { Resend } from "resend";

export async function sendLoginCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Local development without Resend: print the code instead of sending it.
    console.log(`[email] login code for ${email}: ${code}`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "AI Radar <onboarding@resend.dev>",
    to: email,
    subject: `Код для входа в AI Radar: ${code}`,
    text: `Твой код: ${code}\n\nОн действует 10 минут. Если ты не запрашивал код, просто проигнорируй это письмо.`,
    html: `<div style="font-family:sans-serif;font-size:16px;color:#131315">
<p>Твой код для входа в AI Radar:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
<p style="color:#666">Код действует 10 минут. Если ты не запрашивал код, просто проигнорируй это письмо.</p></div>`,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
