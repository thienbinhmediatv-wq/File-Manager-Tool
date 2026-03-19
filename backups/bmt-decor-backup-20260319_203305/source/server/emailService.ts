import nodemailer from "nodemailer";

const SENDERS = [
  {
    email: process.env.GMAIL_SENDER || "thienbinhmedia.tv@gmail.com",
    password: process.env.GMAIL_APP_PASSWORD || "",
  },
  {
    email: process.env.GMAIL_SENDER_2 || "thuyndp.data2@gmail.com",
    password: process.env.GMAIL_APP_PASSWORD_2 || "",
  },
];

function createTransporter(senderIndex: number) {
  const sender = SENDERS[senderIndex];
  if (!sender || !sender.password) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: sender.email,
      pass: sender.password,
    },
  });
}

export async function sendPdfEmail(
  recipientEmail: string,
  projectTitle: string,
  clientName: string,
  pdfUrl: string
): Promise<{ success: boolean; message: string; sender?: string }> {
  for (let i = 0; i < SENDERS.length; i++) {
    const transporter = createTransporter(i);
    if (!transporter) continue;

    try {
      await transporter.sendMail({
        from: `"BMT Decor" <${SENDERS[i].email}>`,
        to: recipientEmail,
        subject: `Hồ sơ thiết kế - ${projectTitle} | BMT Decor`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a365d; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">BMT DECOR</h1>
              <p style="color: #a0aec0; margin: 5px 0 0;">CÔNG TY TNHH TMDV BMT DECOR</p>
            </div>
            <div style="padding: 30px; background: #f7fafc;">
              <h2 style="color: #2d3748;">Hồ sơ thiết kế dự án</h2>
              <p style="color: #4a5568;">Kính gửi <strong>${clientName || "Quý khách"}</strong>,</p>
              <p style="color: #4a5568;">BMT Decor xin gửi đến quý khách hồ sơ thiết kế dự án <strong>"${projectTitle}"</strong>.</p>
              <p style="color: #4a5568;">File PDF bao gồm đầy đủ các nội dung:</p>
              <ul style="color: #4a5568;">
                <li>Phân tích hiện trạng &amp; phong thủy</li>
                <li>Bản vẽ mặt bằng các tầng</li>
                <li>Bản vẽ mặt cắt &amp; mặt đứng</li>
                <li>Thiết kế nội thất</li>
                <li>Render 3D phối cảnh</li>
                <li>Bảng khối lượng &amp; dự toán</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${pdfUrl}" target="_blank"
                   style="background: #e8830c; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
                  📄 Tải xuống hồ sơ PDF
                </a>
              </div>
              <p style="color: #718096; font-size: 13px;">Hoặc copy đường dẫn: <a href="${pdfUrl}" style="color: #3182ce; word-break: break-all;">${pdfUrl}</a></p>
              <p style="color: #4a5568; font-size: 13px;">Link tải sẽ khả dụng trong 7 ngày. Nếu cần chỉnh sửa hoặc tư vấn thêm, vui lòng liên hệ BMT Decor.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #718096; font-size: 13px;">
                <strong>Địa chỉ:</strong> 7/92, Thành Thái, P.14, Q.10, TP.HCM<br>
                <strong>Director:</strong> Võ Quốc Bảo<br>
                <strong>Website:</strong> <a href="https://thicongtramsac.vn" style="color: #3182ce;">thicongtramsac.vn</a>
              </p>
              <p style="color: #a0aec0; font-size: 11px;">© ${new Date().getFullYear()} BMT DECOR. All rights reserved.</p>
            </div>
          </div>
        `,
      });

      return {
        success: true,
        message: `Đã gửi link tải hồ sơ PDF đến ${recipientEmail} thành công!`,
        sender: SENDERS[i].email,
      };
    } catch (err: any) {
      console.error(`Email send failed with ${SENDERS[i].email}:`, err.message);
      if (i < SENDERS.length - 1) {
        console.log(`Trying fallback sender ${SENDERS[i + 1].email}...`);
        continue;
      }
      return {
        success: false,
        message: "Gửi email thất bại. Vui lòng kiểm tra lại địa chỉ email và thử lại.",
      };
    }
  }

  return {
    success: false,
    message: "Không có email gửi nào được cấu hình.",
  };
}
