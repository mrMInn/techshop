import nodemailer from "nodemailer";

export interface AuditLogEmailData {
  userId: string | null;
  userEmail: string | null;
  userFullName: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldData: any;
  newData: any;
  ipAddress?: string | null;
}

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

export async function sendAuditEmailNotification(data: AuditLogEmailData) {
  try {
    const transporter = getTransporter();
    const recipient = process.env.NOTIFICATION_EMAIL_TO;

    if (!transporter || !recipient) {
      // SMTP credentials not set or recipient email missing
      return;
    }

    const { userFullName, userEmail, action, tableName, recordId, oldData, newData } = data;
    const dateStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    // Format changes nicely for email
    let changesHtml = "";
    if (action === "DELETE") {
      changesHtml = `
        <div style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
          <h3 style="color: #c62828; margin-top: 0; font-size: 15px;">⚠️ Dữ liệu đã bị xóa khỏi hệ thống</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin: 0; max-height: 250px; font-family: monospace;">${JSON.stringify(oldData, null, 2)}</pre>
        </div>
      `;
    } else if (action === "CREATE") {
      changesHtml = `
        <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
          <h3 style="color: #2e7d32; margin-top: 0; font-size: 15px;">✅ Dữ liệu mới được thêm vào</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin: 0; max-height: 250px; font-family: monospace;">${JSON.stringify(newData, null, 2)}</pre>
        </div>
      `;
    } else if (action === "UPDATE") {
      const changesList: string[] = [];
      const oldObj = oldData || {};
      const newObj = newData || {};
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

      // We exclude metadata keys that change constantly like updatedAt/createdAt
      const excludedKeys = ["updatedAt", "createdAt"];

      for (const key of allKeys) {
        if (excludedKeys.includes(key)) continue;

        const oldValStr = JSON.stringify(oldObj[key]);
        const newValStr = JSON.stringify(newObj[key]);
        if (oldValStr !== newValStr) {
          const oldValDisplay = oldObj[key] !== undefined && oldObj[key] !== null ? (typeof oldObj[key] === 'object' ? JSON.stringify(oldObj[key]) : String(oldObj[key])) : "(trống)";
          const newValDisplay = newObj[key] !== undefined && newObj[key] !== null ? (typeof newObj[key] === 'object' ? JSON.stringify(newObj[key]) : String(newObj[key])) : "(trống)";
          changesList.push(`
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e5ea; font-weight: bold; background: #fafafa; font-family: monospace;">${key}</td>
              <td style="padding: 10px; border: 1px solid #e5e5ea; color: #c62828; background: #fff5f5; text-decoration: line-through;">${oldValDisplay}</td>
              <td style="padding: 10px; border: 1px solid #e5e5ea; color: #2e7d32; background: #f4faf4; font-weight: 500;">${newValDisplay}</td>
            </tr>
          `);
        }
      }

      if (changesList.length > 0) {
        changesHtml = `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #0066cc; margin-top: 0; font-size: 15px; margin-bottom: 12px;">🔄 Các trường thay đổi dữ liệu:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <thead>
                <tr style="background-color: #f5f5f7; border-bottom: 2px solid #d1d1d6;">
                  <th style="padding: 10px; border: 1px solid #e5e5ea;">Trường thông tin</th>
                  <th style="padding: 10px; border: 1px solid #e5e5ea;">Giá trị cũ</th>
                  <th style="padding: 10px; border: 1px solid #e5e5ea;">Giá trị mới</th>
                </tr>
              </thead>
              <tbody>
                ${changesList.join("")}
              </tbody>
            </table>
          </div>
        `;
      } else {
        changesHtml = `<p style="font-size: 14px; color: #86868b;">Không có thay đổi về mặt giá trị các trường chính (chỉ cập nhật thời gian hệ thống).</p>`;
      }
    }

    const actionText = action === "CREATE" ? "Thêm mới" : action === "UPDATE" ? "Cập nhật" : "Xóa";
    const actionColor = action === "CREATE" ? "#34c759" : action === "UPDATE" ? "#0066cc" : "#ff3b30";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1d1d1f; max-width: 650px; margin: 0 auto; border: 1px solid #e5e5ea; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #1d1d1f 0%, #434345 100%); color: #fff; padding: 28px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Cảnh báo hoạt động ERP</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase;">TechShop ERP System</p>
        </div>
        
        <div style="padding: 28px; line-height: 1.6;">
          <table style="width: 100%; margin-bottom: 24px; border-collapse: collapse; font-size: 13.5px;">
            <tr>
              <td style="padding: 8px 0; color: #86868b; width: 140px; border-bottom: 1px solid #f5f5f7;">Người thực hiện:</td>
              <td style="padding: 8px 0; font-weight: 600; border-bottom: 1px solid #f5f5f7;">${userFullName || "Hệ thống / Tác vụ ẩn"} (${userEmail || "system"})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #86868b; border-bottom: 1px solid #f5f5f7;">Thao tác:</td>
              <td style="padding: 8px 0; font-weight: 700; color: ${actionColor}; border-bottom: 1px solid #f5f5f7;">${actionText} (${action})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #86868b; border-bottom: 1px solid #f5f5f7;">Bảng dữ liệu:</td>
              <td style="padding: 8px 0; font-weight: 600; font-family: monospace; border-bottom: 1px solid #f5f5f7;">${tableName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #86868b; border-bottom: 1px solid #f5f5f7;">Mã bản ghi (ID):</td>
              <td style="padding: 8px 0; font-family: monospace; font-size: 12.5px; color: #555; border-bottom: 1px solid #f5f5f7;">${recordId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #86868b; border-bottom: 1px solid #f5f5f7;">Thời gian xảy ra:</td>
              <td style="padding: 8px 0; font-weight: 500; border-bottom: 1px solid #f5f5f7;">${dateStr}</td>
            </tr>
          </table>

          <div style="border-top: 1px solid #e5e5ea; padding-top: 20px; margin-top: 20px;">
            ${changesHtml}
          </div>

          <div style="text-align: center; margin-top: 36px; padding-top: 16px; border-top: 1px solid #f5f5f7;">
            <p style="font-size: 11px; color: #86868b; margin: 0; line-height: 1.4;">Đây là email tự động cảnh báo bảo mật từ hệ thống quản lý TechShop ERP.<br />Vui lòng không trả lời email này.</p>
          </div>
        </div>
      </div>
    `;

    const subject = `[ERP Alert] ${actionText} bảng ${tableName} bởi ${userFullName || "N/A"}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"TechShop ERP Alerts" <${user}>`,
      to: recipient,
      subject,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Lỗi khi gửi email cảnh báo hoạt động:", error);
  }
}
