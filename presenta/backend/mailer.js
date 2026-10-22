const nodemailer = require('nodemailer');

let transporter;

const configured = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
};

async function send(to, subject, text) {
  if (!configured()) return { sent: false };
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
    return { sent: true };
  } catch (err) {
    console.error('[mailer]', err.message);
    return { sent: false };
  }
}

module.exports = { send, configured };
