const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your@gmail.com",
    pass: "your-app-password"
  }
});

function sendAlert(url, status) {
  const isDown = status === "DOWN";
  const subject = isDown ? `🚨 Website DOWN Alert: ${url}` : `✅ Website UP/RECOVERED: ${url}`;
  const text = isDown ? `The monitor for ${url} has detected a DOWN status. Please investigate.` : `Good news! The monitor for ${url} has recovered and is now UP.`;

  transporter.sendMail({
    to: "your@gmail.com",
    subject: subject,
    text: text
  }).catch(err => console.error("Email send error:", err));
}

module.exports = { sendAlert };