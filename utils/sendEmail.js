require("dotenv").config();

var nodemailer = require('nodemailer');

const sendEmail = (to, from, subject, text) => {
  
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'dhyatagarg09@gmail.com',
    pass: 'crmhhbwjhwexouhw'
  }
});

var mailOptions = {
  from,
  to,
  subject,
  html: text
};

transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
}
// const sgMail = require("@sendgrid/mail");

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const sendEmail = (to, from, subject, text) => {
//   const msg = {
//     to,
//     from,
//     subject,
//     html: text,
//   };

//   sgMail.send(msg, function (err, info) {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log("Email sent successfully.");
//     }
//   });
// };

module.exports = sendEmail;
