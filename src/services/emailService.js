import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendMagicLinkEmail = async (email, token) => {
  const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}`

  // In development, just log the link
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Magic Link:', magicLink)
    return { success: true, devLink: magicLink }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `HatimConnect <${process.env.EMAIL_FROM || 'noreply@hatimconnect.com'}>`,
      to: email,
      subject: 'HatimConnect Giriş Linki',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #11D473;">HatimConnect'e Hoş Geldiniz</h2>
          <p>Aşağıdaki butona tıklayarak giriş yapabilirsiniz:</p>
          <a href="${magicLink}" 
             style="display: inline-block; background-color: #11D473; color: #102219; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
            Giriş Yap
          </a>
          <p style="color: #666; font-size: 14px;">
            Bu link 15 dakika içinde geçerliliğini yitirecektir.
          </p>
          <p style="color: #666; font-size: 14px;">
            Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            HatimConnect - Kolektif Kuran Hatimi
          </p>
        </div>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error('Email gönderilemedi')
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Email error:', error)
    throw error
  }
}

export const sendHatimInviteEmail = async (email, hatimTitle, inviteLink, inviterName) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Invite Link:', inviteLink)
    return { success: true, devLink: inviteLink }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `HatimConnect <${process.env.EMAIL_FROM || 'noreply@hatimconnect.com'}>`,
      to: email,
      subject: `${inviterName} sizi "${hatimTitle}" hatimine davet ediyor`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #11D473;">Hatim Daveti</h2>
          <p><strong>${inviterName}</strong> sizi kolektif bir Kuran hatimine davet ediyor:</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #102219;">${hatimTitle}</h3>
          </div>
          <a href="${inviteLink}" 
             style="display: inline-block; background-color: #11D473; color: #102219; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
            Davetiye'i Kabul Et
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            HatimConnect - Kolektif Kuran Hatimi
          </p>
        </div>
      `
    })

    if (error) throw new Error('Email gönderilemedi')
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Invite email error:', error)
    throw error
  }
}
