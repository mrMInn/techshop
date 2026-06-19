import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const url = "http://localhost:3000/api/telegram/webhook";
  
  const payload = {
    message: {
      message_id: 9999,
      from: {
        id: 12345,
        is_bot: false,
        first_name: "Test User",
        username: "testuser"
      },
      chat: {
        id: parseInt(process.env.TELEGRAM_CHAT_ID || "-5061727908"),
        title: "Test Group",
        type: "group"
      },
      date: Math.floor(Date.now() / 1000),
      text: "bot ơi doanh thu hôm nay thế nào"
    }
  };

  console.log("Sending local mock Telegram message to Webhook...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Response status:", res.status);
    console.log("Response body:", data);
  } catch (error: any) {
    console.error("Error sending request:", error.message);
  }
}

run();
