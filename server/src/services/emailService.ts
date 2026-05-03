import nodemailer from "nodemailer"

const isSmtpConfigured = (): boolean =>
  Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.SMTP_FROM?.trim()
  )

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  if (!isSmtpConfigured()) {
    console.warn(`[Email] SMTP is not configured. Skipping email to ${params.to}.`)
    return
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text
  })
}

export async function sendWelcomeEmail(params: {
  to: string
  name: string
}): Promise<void> {
  try {
    const year = new Date().getFullYear()
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: #1E3A5F; color: white; padding: 20px; text-align: center;">
          <h1>eLibrary</h1>
        </div>
        <div style="background-color: white; padding: 32px; color: #333;">
          <h2 style="font-size: 24px;">Welcome aboard, ${params.name}!</h2>
          <p>Your account has been created successfully.</p>
          
          <ul style="list-style-type: none; padding: 0;">
            <li style="margin-bottom: 10px;">📚 Discover thousands of academic books</li>
            <li style="margin-bottom: 10px;">🤖 Get AI-powered recommendations</li>
            <li style="margin-bottom: 10px;">📖 Track your reading progress</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
            <a href="${process.env.FRONTEND_URL}" style="background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Start Reading Now &rarr;</a>
          </div>
        </div>
        <div style="background-color: #f3f4f6; color: #6b7280; padding: 20px; text-align: center; font-size: 12px;">
          &copy; ${year} eLibrary. All rights reserved.
        </div>
      </div>
    `
    
    const text = `Welcome to eLibrary, ${params.name}!\nYour account has been created successfully.\nVisit: ${process.env.FRONTEND_URL}\nHappy reading!`
    
    await sendEmail({
      to: params.to,
      subject: `Welcome to eLibrary, ${params.name}!`,
      html,
      text
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Email] Welcome email failed:", message)
  }
}

export async function sendPasswordResetEmail(params: {
  to: string
  name: string
  resetToken: string
  expiresInMinutes: number
}): Promise<void> {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${params.resetToken}`
    const expiryTime = new Date(Date.now() + params.expiresInMinutes * 60 * 1000).toLocaleString()
    
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: white; padding: 32px; color: #333;">
          <p>Hi ${params.name},</p>
          <p>We received a request to reset your password.</p>
          <p>This link expires in ${params.expiresInMinutes} minutes.</p>
          
          <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
            <a href="${resetUrl}" style="background-color: #DC2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Reset Password &rarr;</a>
          </div>
          
          <p style="font-size: 14px;">If you did not request this, ignore this email. Your password will not change.</p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">Link expires at ${expiryTime}</p>
        </div>
      </div>
    `
    
    const text = `Hi ${params.name},\nWe received a request to reset your password. Please visit: ${resetUrl}\nThis link expires in ${params.expiresInMinutes} minutes.\nIf you did not request this, ignore this email.`
    
    await sendEmail({
      to: params.to,
      subject: "Reset your eLibrary password",
      html,
      text
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Email] Password reset email failed:", message)
  }
}

export async function sendPasswordChangedEmail(params: {
  to: string
  name: string
}): Promise<void> {
  try {
    const html = `<p>Hi ${params.name},</p><p>Your eLibrary password was successfully changed.</p><p>If this was not you, please contact support immediately.</p>`
    const text = `Hi ${params.name},\nYour eLibrary password was successfully changed.\nIf this was not you, please contact support immediately.`
    
    await sendEmail({
      to: params.to,
      subject: "Your eLibrary password was changed",
      html,
      text
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Email] Password changed email failed:", message)
  }
}
