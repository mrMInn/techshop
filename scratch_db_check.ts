async function main() {
  try {
    const url = "https://api.telegram.org/bot8758821009:AAEOpComfVnFV8TfvNQ56S5qA1FfsihKLWQ/getWebhookInfo";
    const res = await fetch(url);
    const data = await res.json();
    console.log("=== TELEGRAM WEBHOOK INFO ===");
    console.log(data);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

main();
