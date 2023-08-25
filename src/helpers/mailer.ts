import nodemailer from "nodemailer";

export const sendMail = async (mailOptions: any) => {
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD,
      },
    });

    const result = await transport.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.log("bb", error);
  }
};
