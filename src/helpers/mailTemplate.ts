export const passwordRequestMail = (link: string) => {
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
