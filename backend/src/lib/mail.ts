import nodemailer from "nodemailer";

export async function getMailClient() {
  const account = await nodemailer.createTestAccount();

  const transpoter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });

  return transpoter;
}