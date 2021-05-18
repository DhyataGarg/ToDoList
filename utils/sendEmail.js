require("dotenv").config();
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SG_API_KEY);

const sendEmail = (to, from, subject, text) => {
  const msg = {
    to,
    from,
    subject,
    html: text,
  };

  sgMail.send(msg, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Email sent successfully.");
    }
  });
};

module.exports = sendEmail;
