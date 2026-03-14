const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const smtpUser = defineString('SMTP_USER', { default: 'notificacionesalo1@alocredit.co' });
const smtpPass = defineString('SMTP_PASS', { default: 'nekz gpcx mbwo mdfc' });

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser.value(),
      pass: smtpPass.value(),
    },
  });
}

function buildHtmlEmail(body, subject) {
  const bodyHtml = body.replace(/\n/g, '<br/>');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 0;">
      <div style="background: linear-gradient(135deg, #0f766e, #14b8a6); border-radius: 0 0 24px 24px; padding: 32px 28px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px;">TallerFlow Muebles</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">${subject}</p>
      </div>
      <div style="padding: 28px 24px;">
        <div style="background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e9ecef; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
          ${bodyHtml}
        </div>
      </div>
      <div style="text-align: center; padding: 16px 24px 28px;">
        <p style="color: #6c757d; font-size: 12px; margin: 0;">
          Este correo fue enviado automáticamente por TallerFlow Muebles.<br/>
          No responda a este mensaje.
        </p>
      </div>
    </div>
  `;
}

exports.mailQueueCreated = onDocumentCreated('mailQueue/{mailId}', async (event) => {
  const payload = event.data?.data();
  const mailId = event.params.mailId;

  if (!payload) {
    logger.warn('mailQueue payload missing');
    return;
  }

  logger.info('mailQueue item received', { recipient: payload.recipient, subject: payload.subject });

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: '"TallerFlow Muebles" <notificacionesalo1@alocredit.co>',
      to: payload.recipient,
      subject: payload.subject,
      text: payload.body,
      html: buildHtmlEmail(payload.body, payload.subject),
    });

    logger.info('Email sent successfully', { recipient: payload.recipient });

    await admin.firestore().collection('mailQueueLogs').add({
      ...payload,
      receivedAt: new Date().toISOString(),
      status: 'sent',
    });

    await admin.firestore().collection('mailQueue').doc(mailId).set(
      {
        status: 'sent',
        processedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.error('Failed to send email', { error: error.message, recipient: payload.recipient });

    await admin.firestore().collection('mailQueueLogs').add({
      ...payload,
      receivedAt: new Date().toISOString(),
      status: 'failed',
      error: error.message,
    });

    await admin.firestore().collection('mailQueue').doc(mailId).set(
      {
        status: 'failed',
        processedAt: new Date().toISOString(),
        error: error.message,
      },
      { merge: true },
    );
  }
});
