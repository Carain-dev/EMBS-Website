const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    ...(replyTo && { replyTo }),
    subject,
    html,
    text,
  });
};

module.exports = sendEmail;
