interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  locale?: "EN" | "FR";
}

type SendEmailResult =
  | { ok: true; provider: "brevo" | "resend"; messageId?: string; dev?: false }
  | { ok: true; dev: true }
  | { ok: false; error: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function emailLayout(content: string, locale: "EN" | "FR" = "EN"): string {
  const french = locale === "FR";
  const footer = french
    ? "Vous recevez cet e-mail à la suite d’une activité sur LynoraLink."
    : "You’re receiving this email because of activity on LynoraLink.";
  const tagline = french
    ? "Construisons la suite, ensemble."
    : "Build what’s next, together.";

  return `<!doctype html>
<html lang="${french ? "fr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>LynoraLink</title>
  </head>
  <body style="margin:0;padding:0;background-color:#071120;font-family:Arial,Helvetica,sans-serif;color:#f8fafc">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${tagline}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#071120">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
            <tr>
              <td bgcolor="#132238" style="overflow:hidden;border:1px solid #283d54;border-radius:16px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:24px 32px;border-top:3px solid #12a98c;border-bottom:1px solid #283d54">
                      <span style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#f8fafc">Lynora<span style="color:#22b8d4">Link</span></span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;color:#f8fafc;font-size:15px;line-height:1.7">${content}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 16px 0;color:#9db0c0;font-size:12px;line-height:1.6">
                <p style="margin:0 0 6px;color:#7ee5d3;font-weight:600">${tagline}</p>
                <p style="margin:0">${footer}</p>
                <p style="margin:8px 0 0"><a href="${escapeHtml(appUrl())}" style="color:#22b8d4;text-decoration:none">lynoralink.app</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendTwoFactorCodeEmail({
  to,
  name,
  code,
  purpose,
  locale,
}: {
  to: string;
  name: string;
  code: string;
  purpose: "login" | "setup" | "registration" | "deletion";
  locale?: "EN" | "FR";
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL;
  const senderName = process.env.BREVO_FROM_NAME ?? "LynoraLink";
  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV !== "production") {
      const french = locale === "FR";
      const subject = french
        ? purpose === "login" ? "Votre code de connexion LynoraLink" : purpose === "registration" ? "Confirmez votre email LynoraLink" : purpose === "deletion" ? "Confirmez la suppression de votre compte LynoraLink" : "Votre code de sécurité LynoraLink"
        : purpose === "login" ? "Your LynoraLink sign-in code" : purpose === "registration" ? "Verify your LynoraLink email" : purpose === "deletion" ? "Confirm your LynoraLink account deletion" : "Your LynoraLink security code";
      console.info(`[DEV EMAIL] to=${to}\nsubject=${subject}\ncode=${code}`);
      return;
    }
    throw new Error("Brevo email configuration is missing");
  }

  const safeName = escapeHtml(name);
  const french = locale === "FR";
  const subject = french
    ? purpose === "login" ? "Votre code de connexion LynoraLink" : purpose === "registration" ? "Confirmez votre email LynoraLink" : purpose === "deletion" ? "Confirmez la suppression de votre compte LynoraLink" : "Votre code de sécurité LynoraLink"
    : purpose === "login" ? "Your LynoraLink sign-in code" : purpose === "registration" ? "Verify your LynoraLink email" : purpose === "deletion" ? "Confirm your LynoraLink account deletion" : "Your LynoraLink security code";
  const purposeText = french
    ? purpose === "login" ? "terminer votre connexion" : purpose === "registration" ? "confirmer votre adresse email" : purpose === "deletion" ? "confirmer la suppression définitive de votre compte" : "confirmer ce changement de sécurité"
    : purpose === "login" ? "complete your sign-in" : purpose === "registration" ? "verify your email address" : purpose === "deletion" ? "confirm the permanent deletion of your account" : "confirm this security change";
  const htmlContent = emailLayout(`
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">${french ? "Votre code de sécurité" : "Your security code"}</h1>
    <p style="margin:0 0 20px">${french ? `Bonjour ${safeName}, utilisez ce code pour` : `Hello ${safeName}, use this code to`} <strong style="color:#7ee5d3">${purposeText}</strong>:</p>
    <div style="margin:0 0 20px;padding:18px;border:1px solid #285b60;border-radius:12px;background-color:#102c39;text-align:center;font-size:32px;font-weight:700;letter-spacing:7px;color:#7ee5d3">${escapeHtml(code)}</div>
    <p style="margin:0 0 12px">${french ? "Ce code expire dans 10 minutes et ne peut être utilisé qu’une fois." : "This code expires in 10 minutes and can only be used once."}</p>
    <p style="margin:0;color:#9db0c0;font-size:13px">${french ? "Si vous n’avez pas demandé ce code, ignorez cet e-mail." : "If you didn't request this code, you can ignore this email."}</p>
  `, french ? "FR" : "EN");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent: french
        ? `Votre code LynoraLink est ${code}. Il expire dans 10 minutes.`
        : `Your LynoraLink code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw new Error(`Brevo email request failed with status ${response.status}`);
}

export async function sendPasswordResetEmail({
  to,
  name,
  link,
  locale,
}: {
  to: string;
  name: string;
  link: string;
  locale: "EN" | "FR";
}) {
  const safeName = escapeHtml(name);
  const french = locale === "FR";
  const subject = french ? "Réinitialisez votre mot de passe LynoraLink" : "Reset your LynoraLink password";
  const htmlContent = emailLayout(`
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">${french ? "Réinitialisation du mot de passe" : "Password reset"}</h1>
    <p style="margin:0 0 12px">${french ? `Bonjour ${safeName},` : `Hello ${safeName},`}</p>
    <p style="margin:0 0 24px">${french ? "Nous avons reçu une demande de réinitialisation de votre mot de passe." : "We received a request to reset your password."}</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;border-radius:9px;background-color:#12a98c;color:#071120;text-decoration:none;font-weight:700">${french ? "Choisir un nouveau mot de passe" : "Choose a new password"}</a></p>
    <p style="margin:0 0 12px">${french ? "Ce lien expire dans une heure et ne peut être utilisé qu’une fois." : "This link expires in one hour and can only be used once."}</p>
    <p style="margin:0;color:#9db0c0;font-size:13px">${french ? "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail." : "If you didn't request this, you can ignore this email."}</p>
  `, locale);
  const textContent = french
    ? `Bonjour ${name}, réinitialisez votre mot de passe avec ce lien (valable une heure): ${link}`
    : `Hello ${name}, reset your password with this link (valid for one hour): ${link}`;

  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_FROM_EMAIL;
  if (brevoApiKey && brevoSenderEmail) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: brevoSenderEmail, name: process.env.BREVO_FROM_NAME ?? "LynoraLink" },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
    });
    if (!response.ok) throw new Error(`Brevo email request failed with status ${response.status}`);
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "LynoraLink <no-reply@lynoralink.app>",
        to: [to],
        subject,
        html: htmlContent,
        text: textContent,
      }),
    });
    if (!response.ok) throw new Error(`Resend email request failed with status ${response.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Password reset email requires Brevo or Resend configuration");
  }

  console.info(`[DEV EMAIL] to=${to}\nsubject=${subject}\n${textContent}`);
}

export async function sendEmail({ to, subject, html, text, replyTo, locale }: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_FROM_EMAIL;
  const from = process.env.EMAIL_FROM ?? "LynoraLink <no-reply@lynoralink.app>";
  const htmlContent = emailLayout(html, locale);
  if (!apiKey && brevoApiKey && brevoSenderEmail) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: brevoSenderEmail, name: process.env.BREVO_FROM_NAME ?? "LynoraLink" },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent: text,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("Email send failed:", error);
      return { ok: false, error };
    }
    const result = await response.json().catch(() => null) as { messageId?: unknown } | null;
    return { ok: true, provider: "brevo", ...(typeof result?.messageId === "string" ? { messageId: result.messageId } : {}) };
  }
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery requires RESEND_API_KEY or Brevo configuration in production");
    }
    console.info(`[DEV EMAIL] to=${to}\nsubject=${subject}\n${text ?? html.replace(/<[^>]+>/g, "")}`);
    return { ok: true, dev: true };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html: htmlContent, text, reply_to: replyTo }),
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Email send failed:", error);
    return { ok: false, error };
  }
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  return { ok: true, provider: "resend", ...(typeof result?.id === "string" ? { messageId: result.id } : {}) };
}

export async function sendMarketplaceVerificationEmail({
  to,
  name,
  link,
  locale,
}: {
  to: string;
  name: string;
  link: string;
  locale: "EN" | "FR";
}) {
  const french = locale === "FR";
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  const subject = french ? "Confirmez votre compte vendeur LynoraLink" : "Verify your LynoraLink seller account";
  const heading = french ? "Vérifiez votre compte" : "Verify your account";
  const confirmation = french
    ? "Confirmez votre adresse e-mail pour poursuivre la vérification de votre compte vendeur."
    : "Confirm your email address to continue setting up your seller account.";
  const button = french ? "Confirmer mon adresse e-mail" : "Confirm my email address";
  const access = french
    ? "Après confirmation, choisissez votre abonnement vendeur à 15 $ par mois ou 180 $ par an pour activer votre espace vendeur."
    : "After confirming, choose your seller plan at $15 per month or $180 per year to activate your seller workspace.";
  const expiry = french
    ? "Ce lien est valable 48 heures. Si vous n’avez pas fait cette demande, ignorez cet e-mail."
    : "This link is valid for 48 hours. If you did not make this request, ignore this email.";
  const html = emailLayout(`
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">${heading}</h1>
    <p style="margin:0 0 12px">${french ? "Bonjour" : "Hello"} ${safeName},</p>
    <p style="margin:0 0 18px">${confirmation}</p>
    <p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;padding:13px 22px;border-radius:9px;background-color:#12a98c;color:#071120;text-decoration:none;font-weight:700">${button}</a></p>
    <p style="margin:0 0 18px">${access}</p>
    <p style="margin:0;color:#9db0c0;font-size:13px">${expiry}</p>
  `, locale);
  const text = `${french ? `Bonjour ${name},` : `Hello ${name},`}\n\n${confirmation}\n${link}\n\n${access}\n\n${expiry}`;
  const result = await sendEmail({ to, subject, html, text, locale });
  if (!result.ok) throw new Error("marketplace_verification_email_send_failed");
  if ("dev" in result && result.dev) {
    throw new Error("marketplace_verification_email_transport_not_configured");
  }
  if ("provider" in result) {
    console.info("Marketplace verification email accepted by provider", {
      provider: result.provider,
      messageId: result.messageId,
    });
  }
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function verificationEmailTemplate(name: string, link: string) {
  return emailLayout(`
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">Welcome to LynoraLink, ${escapeHtml(name)}!</h1>
    <p style="margin:0 0 24px">Confirm your email address to activate your co-building space.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;border-radius:9px;background-color:#12a98c;color:#071120;text-decoration:none;font-weight:700">Verify my email</a></p>
    <p style="margin:0;color:#9db0c0;font-size:13px">If you didn't create an account, you can ignore this email.</p>
  `);
}

export function resetEmailTemplate(name: string, link: string) {
  return emailLayout(`
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">Password reset</h1>
    <p style="margin:0 0 24px">Hi ${escapeHtml(name)}, we received a request to reset your password.</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;border-radius:9px;background-color:#12a98c;color:#071120;text-decoration:none;font-weight:700">Reset my password</a></p>
    <p style="margin:0;color:#9db0c0;font-size:13px">This link expires in 1 hour. If you didn't request it, ignore this email.</p>
  `);
}
