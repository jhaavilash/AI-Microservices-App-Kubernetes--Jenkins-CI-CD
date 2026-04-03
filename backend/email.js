const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your@gmail.com",
    pass: "your-app-password"
  }
});

function sendAlert(url) {
  transporter.sendMail({
    to: "your@gmail.com",
    subject: "🚨 Website DOWN Alert",
    text: `${url} is DOWN`
  });
}

module.exports = { sendAlert };