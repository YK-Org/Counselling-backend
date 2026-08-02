// Links now carry more than one query parameter, so the `&` has to be escaped:
// a raw `&` in an href is invalid HTML and some email clients mangle it.
// Renders identically to a bare `&` in both attribute and text contexts.
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const passwordRequestMail = (rawLink: string) => {
  const link = escapeHtml(rawLink);
  return `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #f7f7f7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo {
      width: 100px;
      height: auto;
    }
    .content {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="http://trinityunitedchurchlegon.org/assets/img/Trinity-Logo.png" alt="Logo" class="logo">
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password. If you did not make this request, please ignore this email.</p>
      <p>To reset your password, click the link below:</p>
      <a href="${link}">Reset Password</a>
    </div>
    <p>If the button above does not work, you can also copy and paste the following link into your web browser:</p>
    <p>${link}</p>
    <p>Thank you,</p>
    <p>Counsellor App</p>
  </div>
</body>
</html>
 `;
};

// Every message below has a plain-text counterpart. Sending `text: ""` with an
// HTML-only body is a well-known spam signal — spam filters expect a
// multipart/alternative message with a real text part.
export const inviteMailText = (
  firstName: string,
  roleLabel: string,
  link: string
) =>
  `Hello ${firstName},

An account has been created for you on the Counsellor App as a ${roleLabel}.

To choose your password and activate your account, open this link:
${link}

This link expires in 7 days and can only be used once.

Thank you,
Counsellor App`;

export const passwordRequestMailText = (link: string) =>
  `Hello,

We received a request to reset your password. If you did not make this request, you can ignore this email.

To reset your password, open this link:
${link}

Thank you,
Counsellor App`;

export const inviteMail = (
  firstName: string,
  roleLabel: string,
  rawLink: string
) => {
  const link = escapeHtml(rawLink);
  return `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You have been invited</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #f7f7f7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo {
      width: 100px;
      height: auto;
    }
    .content {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="http://trinityunitedchurchlegon.org/assets/img/Trinity-Logo.png" alt="Logo" class="logo">
      <h1>Welcome</h1>
    </div>
    <div class="content">
      <p>Hello ${firstName},</p>
      <p>An account has been created for you on the Counsellor App as a ${roleLabel}.</p>
      <p>To choose your password and activate your account, click the link below:</p>
      <a href="${link}">Set your password</a>
      <p>This link expires in 7 days and can only be used once.</p>
    </div>
    <p>If the link above does not work, you can also copy and paste the following into your web browser:</p>
    <p>${link}</p>
    <p>Thank you,</p>
    <p>Counsellor App</p>
  </div>
</body>
</html>
 `;
};

export const assignCounsellorMail = (
  partners: {
    name1: string;
    name2: string;
  },
  link: string
) => {
  return `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #f7f7f7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo {
      width: 100px;
      height: auto;
    }
    .content {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="http://trinityunitedchurchlegon.org/assets/img/Trinity-Logo.png" alt="Logo" class="logo">
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You have been assigned as the counselor for a couple. Here are the details: </p>
      <span><h3>Couple Names:</h3> <p>${partners.name1} and ${partners.name2}</p></span>
      <p>Please confirm your availability and acceptance by clicking on the link below:</p>
      <a href="${link}" style="color: blue; text-decoration: underline;">${link}</a>
      <p>Feel free to reach out if you have any questions or need further information.</p>
    </div>
    <p>Thank you,</p>
    <p>Counsellor App</p>
  </div>
</body>
</html>
 `;
};
