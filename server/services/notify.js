import nodemailer from 'nodemailer';
import { config, smtpConfigured, webhookConfigured } from '../config.js';

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

export function deliveryChannels() {
  return {
    email: smtpConfigured,
    webhook: webhookConfigured,
  };
}

/** Human-readable summary of which channels exist, used by the UI. */
export function channelSummary() {
  const channels = deliveryChannels();
  return {
    channels,
    anyConfigured: channels.email || channels.webhook,
    message: channels.email
      ? 'Email alerts are configured (SMTP).'
      : 'No email provider is configured, so alerts stay inside SAFEPATH. Set SMTP_HOST, SMTP_USER and SMTP_PASS to deliver email to trusted contacts.',
  };
}

async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    return { channel: 'email', to, status: 'not_configured', detail: 'SMTP is not configured.' };
  }
  try {
    const info = await transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
    return { channel: 'email', to, status: 'sent', detail: info.messageId || 'accepted by SMTP server' };
  } catch (err) {
    return { channel: 'email', to, status: 'failed', detail: err.message };
  }
}

async function sendWebhook(payload) {
  if (!config.sosWebhookUrl) {
    return { channel: 'webhook', status: 'not_configured', detail: 'SOS_WEBHOOK_URL is not configured.' };
  }
  try {
    const res = await fetch(config.sosWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return {
      channel: 'webhook',
      status: res.ok ? 'sent' : 'failed',
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return { channel: 'webhook', status: 'failed', detail: err.message };
  }
}

/**
 * Deliver an SOS alert. Returns a per-contact delivery log so the UI can show
 * exactly what was delivered instead of claiming success.
 */
export async function deliverSos({ user, contacts, alert }) {
  const mapsLink =
    alert.latitude != null
      ? `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`
      : null;
  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const subject = `SAFEPATH SOS alert from ${user.full_name}`;
  const bodyLines = [
    `${user.full_name} activated the SAFEPATH emergency button.`,
    '',
    alert.message ? `Message: ${alert.message}` : '',
    mapsLink ? `Live location: ${mapsLink}` : 'Location could not be captured (GPS unavailable).',
    alert.accuracy ? `GPS accuracy: about ${Math.round(alert.accuracy)} m` : '',
    `Time: ${when}`,
    '',
    'If you cannot reach them, call 112 (India emergency helpline) and share this location.',
  ].filter(Boolean);

  const log = [];
  const jobs = [];

  for (const contact of contacts) {
    if (contact.email) {
      jobs.push(
        sendEmail({
          to: contact.email,
          subject: `[SAFEPATH SOS] ${subject}`,
          text: bodyLines.join('\n'),
          html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">
            <h2 style="color:#7c3aed">SAFEPATH SOS alert</h2>
            <p><strong>${user.full_name}</strong> activated the SAFEPATH emergency button.</p>
            ${alert.message ? `<p>${escapeHtml(alert.message)}</p>` : ''}
            ${mapsLink ? `<p><a href="${mapsLink}">Open live location on Google Maps</a></p>` : '<p>Location could not be captured.</p>'}
            <p>Time: ${when}</p>
            <p style="color:#b91c1c"><strong>If you cannot reach them, call 112 and share this location.</strong></p>
          </div>`,
        }).then((r) => ({ ...r, contactName: contact.name, contactId: contact.id })),
      );
    } else {
      log.push({
        contactId: contact.id,
        contactName: contact.name,
        channel: 'email',
        status: 'skipped',
        detail: 'This contact has no email address, so no email alert could be delivered.',
      });
    }
  }

  if (webhookConfigured) {
    jobs.push(
      sendWebhook({
        text: `SAFEPATH SOS: ${user.full_name} needs help.${mapsLink ? ` Location: ${mapsLink}` : ''}`,
        alertId: alert.id,
        userId: user.id,
        userName: user.full_name,
        latitude: alert.latitude,
        longitude: alert.longitude,
        mapsLink,
        message: alert.message,
        time: new Date().toISOString(),
      }).then((r) => ({ ...r, contactName: 'SAFEPATH webhook', contactId: null })),
    );
  }

  const results = await Promise.all(jobs);
  log.push(...results);

  const delivered = results.filter((r) => r.status === 'sent').length;
  return { log, delivered, configured: deliveryChannels() };
}

export async function sendPasswordResetEmail(user, resetUrl) {
  if (!transporter) {
    return { status: 'not_configured', detail: 'SMTP is not configured; reset link shown in-app instead.' };
  }
  return sendEmail({
    to: user.email,
    subject: 'Reset your SAFEPATH password',
    text: `Hi ${user.full_name},\n\nReset your SAFEPATH password using this link (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.full_name)},</p>
      <p>Reset your SAFEPATH password using the link below. It is valid for 30 minutes.</p>
      <p><a href="${resetUrl}">Reset my password</a></p>
      <p>If you did not request this, you can ignore this email.</p>`,
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
