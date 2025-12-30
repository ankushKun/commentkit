/**
 * Email sending utilities using Resend SDK
 * Official docs: https://resend.com/docs/send-with-cloudflare-workers
 */

import { Resend } from 'resend';

/**
 * Send a magic link email using Resend SDK
 */
export async function sendMagicLinkEmail(
    email: string,
    magicLink: string,
    apiKey: string
): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const resend = new Resend(apiKey);

        const { data, error } = await resend.emails.send({
            from: 'Ankush from CommentKit <commentkit@ankush.one>',
            to: [email],
            subject: 'Your login link for CommentKit',
            html: getMagicLinkEmailTemplate(email, magicLink),
        });

        if (error) {
            console.error('Resend SDK error:', error);
            return { success: false, error: error.message || String(error) };
        }

        console.log('Email sent successfully:', data);
        return { success: true, id: data?.id };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Generate the HTML template for magic link emails
 */
function getMagicLinkEmailTemplate(email: string, magicLink: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your CommentKit Login Link</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
            padding: 40px 20px;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
        }
        .container {
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #6366f1;
            padding: 32px 40px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.5px;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 16px;
        }
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.7;
        }
        .button-container {
            text-align: center;
            margin: 32px 0;
        }
        .button {
            display: inline-block;
            background-color: #6366f1 !important;
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        .button:hover {
            background-color: #4f46e5 !important;
        }
        .divider {
            display: block;
            text-align: center;
            margin: 32px 0;
            position: relative;
        }
        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            border-top: 1px solid #e5e7eb;
            z-index: 1;
        }
        .divider span {
            position: relative;
            z-index: 2;
            background: #ffffff;
            padding: 0 16px;
            color: #9ca3af;
            font-size: 14px;
        }
        .link-section {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
        }
        .link-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 12px;
            font-weight: 500;
        }
        .link-box {
            background-color: #ffffff;
            border: 1px solid #d1d5db;
            padding: 12px 16px;
            border-radius: 6px;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            word-break: break-all;
            color: #374151;
            line-height: 1.5;
        }
        .signature {
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
        }
        .signature-name {
            font-size: 16px;
            color: #111827;
            margin-bottom: 4px;
        }
        .signature-title {
            font-size: 14px;
            color: #6b7280;
        }
        .footer {
            background-color: #f9fafb;
            padding: 32px 40px;
            border-top: 1px solid #e5e7eb;
        }
        .footer-section {
            margin-bottom: 20px;
        }
        .footer-section:last-child {
            margin-bottom: 0;
        }
        .expiry-notice {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .expiry-notice p {
            font-size: 14px;
            color: #92400e;
            font-weight: 600;
            margin: 0;
        }
        .footer-text {
            font-size: 14px;
            color: #6b7280;
            margin: 8px 0;
        }
        .footer-meta {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <!-- Header -->
            <div class="header">
                <div class="logo">CommentKit</div>
            </div>
            
            <!-- Main Content -->
            <div class="content">
                <div class="greeting">Hey there! 👋</div>
                
                <p class="message">
                    Thanks for using CommentKit. Click the button below to sign in to your account:
                </p>

                <div class="button-container">
                    <a href="${magicLink}" class="button">Sign in to CommentKit</a>
                </div>

                <div class="divider">
                    <span>or</span>
                </div>

                <div class="link-section">
                    <div class="link-label">Copy and paste this link:</div>
                    <div class="link-box">${magicLink}</div>
                </div>

                <div class="signature">
                    <div class="signature-name">Best,<br><strong>Ankush</strong></div>
                    <div class="signature-title">Founder, CommentKit</div>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <div class="expiry-notice">
                    <p>⏰ This link expires in 15 minutes</p>
                </div>
                
                <p class="footer-text">
                    If you didn't request this, you can safely ignore this email.
                </p>
                
                <div class="footer-meta">
                    Sent to ${email}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();
}
