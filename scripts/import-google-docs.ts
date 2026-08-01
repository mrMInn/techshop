import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

// Load configuration
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Slugify helper
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\s+/g, "-")           // replace spaces with -
    .replace(/[^\w\-]+/g, "")       // remove non-word chars
    .replace(/\-\-+/g, "-")         // replace multiple - with single -
    .replace(/^-+/, "")              // trim leading -
    .replace(/-+$/, "");             // trim trailing -
}

// Clean price string/number into decimal number
function parsePrice(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d]/g, "");
  return parseInt(cleaned, 10) || 0;
}

// Parse date into Date object (or null)
function parseDateVal(val: any): Date | null {
  if (val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-") return null;
  
  // If Excel serial date number (e.g. 45123)
  if (typeof val === "number") {
    // Excel base date is Dec 30, 1899 due to leap year bug
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const cleaned = String(val).trim();
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day, 12, 0, 0); // use noon to avoid timezone shifts
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date;
}

// Extract specs (RAM / SSD) from product name
function extractSpecs(name: string) {
  const specs: Record<string, string> = {};
  
  const ramSsdMatch = name.match(/(\d+)\/(\d+)/);
  if (ramSsdMatch) {
    specs.ram = `${ramSsdMatch[1]}GB`;
    const ssdVal = parseInt(ramSsdMatch[2], 10);
    specs.ssd = ssdVal < 100 ? `${ssdVal}GB` : `${ssdVal}GB`;
    if (ssdVal === 1 || ssdVal === 2) {
      specs.ssd = `${ssdVal}TB`;
    }
  } else {
    const ramMatch = name.match(/(\d+)\s*gb\s*ram/i) || name.match(/ram\s*(\d+)\s*gb/i) || name.match(/\b(\d+)g\b/i);
    if (ramMatch) {
      specs.ram = `${ramMatch[1]}GB`;
    }
    const ssdMatch = name.match(/(\d+)\s*gb\s*ssd/i) || name.match(/ssd\s*(\d+)\s*gb/i) || name.match(/\b(128|256|512|1024)\b/);
    if (ssdMatch) {
      specs.ssd = `${ssdMatch[1]}GB`;
    }
  }

  if (name.toLowerCase().includes("m1 pro")) specs.cpu = "Apple M1 Pro";
  else if (name.toLowerCase().includes("m1 max")) specs.cpu = "Apple M1 Max";
  else if (name.toLowerCase().includes("m2 pro")) specs.cpu = "Apple M2 Pro";
  else if (name.toLowerCase().includes("m2 max")) specs.cpu = "Apple M2 Max";
  else if (name.toLowerCase().includes("m3 pro")) specs.cpu = "Apple M3 Pro";
  else if (name.toLowerCase().includes("m3 max")) specs.cpu = "Apple M3 Max";
  else if (name.toLowerCase().includes("m1")) specs.cpu = "Apple M1";
  else if (name.toLowerCase().includes("m2")) specs.cpu = "Apple M2";
  else if (name.toLowerCase().includes("m3")) specs.cpu = "Apple M3";

  const screenMatch = name.match(/\b(13|14|15|16)\b/);
  if (screenMatch) {
    specs.screen = `${screenMatch[1]}-inch`;
  }

  return specs;
}

async function main() {
  const xlsxPath = path.resolve(process.cwd(), "google-docs-import.xlsx");
  const csvPath = path.resolve(process.cwd(), "google-docs-import.csv");
  
  let useXlsx = false;
  let filePath = "";

  if (fs.existsSync(xlsxPath)) {
    useXlsx = true;
    filePath = xlsxPath;
  } else if (fs.existsSync(csvPath)) {
    filePath = csvPath;
  } else {
    console.error("❌ Không tìm thấy file dữ liệu import.");
    console.log("💡 Vui lòng thực hiện một trong hai cách:");
    console.log("   - Cách A: Tải file Excel (.xlsx) từ Google Sheets về, đặt tên là 'google-docs-import.xlsx' tại thư mục gốc dự án.");
    console.log("   - Cách B: Tải file CSV (.csv) từ Google Sheets về, đặt tên là 'google-docs-import.csv' tại thư mục gốc dự án.");
    process.exit(1);
  }

  const { db, recalculateRunningBalances } = await import("../src/lib/db");
  const schema = await import("../src/lib/db/schema");
  const { eq, ilike } = await import("drizzle-orm");

  console.log(`📖 Đang đọc file dữ liệu: ${path.basename(filePath)}...`);
  
  let rawLines: any[][] = [];

  if (useXlsx) {
    // Read using sheetjs (XLSX)
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convert sheet to row array of arrays
    rawLines = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
  } else {
    // Read CSV file
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
      console.error("❌ File CSV trống hoặc thiếu tiêu đề.");
      process.exit(1);
    }
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    console.log(`🔍 Phát hiện dấu phân cách CSV: ${delimiter === "\t" ? "Tab" : "Comma"}`);

    rawLines = lines.map(line => {
      if (delimiter === "\t") {
        return line.split("\t");
      } else {
        let insideQuote = false;
        let entry = "";
        const cells = [];
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            cells.push(entry);
            entry = "";
          } else {
            entry += char;
          }
        }
        cells.push(entry);
        return cells;
      }
    });
  }

  if (rawLines.length < 1) {
    console.error("❌ File trống.");
    process.exit(1);
  }

  // DYNAMIC HEADER DETECTION
  let headerRowIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const row = rawLines[i];
    if (row && row.length > 0) {
      const rowStr = row.map(cell => String(cell || "").trim().toLowerCase());
      const hasTen = rowStr.some(cell => cell.includes("tên mặt hàng") || cell === "ten" || cell === "tên");
      const hasGia = rowStr.some(cell => cell.includes("giá nhập") || cell.includes("gia nhap") || cell === "giá");
      if (hasTen && hasGia) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    console.error("❌ Không tự động tìm thấy hàng tiêu đề chứa cột 'Tên mặt hàng' và 'Giá nhập'.");
    console.log("💡 Hàng tiêu đề của bạn phải chứa các cột có tên dạng: 'Tên mặt hàng', 'Giá nhập'");
    process.exit(1);
  }

  console.log(`🎯 Tìm thấy hàng tiêu đề tại dòng chỉ mục: ${headerRowIdx + 1}`);

  const headers = rawLines[headerRowIdx].map((h: any) => String(h || "").trim().toLowerCase());
  console.log("📋 Danh sách cột đọc được:", headers);

  const getColIdx = (name: string) => {
    return headers.findIndex(h => h.includes(name.toLowerCase()));
  };

  const idxStt = getColIdx("stt");
  const idxId = getColIdx("id");
  const idxTen = getColIdx("tên mặt hàng") !== -1 ? getColIdx("tên mặt hàng") : getColIdx("ten");
  const idxTrangThai = getColIdx("trạng thái") !== -1 ? getColIdx("trạng thái") : getColIdx("trang thai");
  const idxNgayNhap = getColIdx("ngày nhập") !== -1 ? getColIdx("ngày nhập") : getColIdx("ngay nhap");
  const idxNgayNhan = getColIdx("ngày nhận") !== -1 ? getColIdx("ngày nhận") : getColIdx("ngay nhan");
  const idxGiaNhap = getColIdx("giá nhập") !== -1 ? getColIdx("giá nhập") : getColIdx("gia nhap");
  const idxChiPhi = getColIdx("chi phí") !== -1 ? getColIdx("chi phí") : getColIdx("chi phi");
  const idxTongChiPhi = getColIdx("tổng chi phí") !== -1 ? getColIdx("tổng chi phí") : getColIdx("tong chi phi");
  const idxGiaBan = getColIdx("giá bán") !== -1 ? getColIdx("giá bán") : getColIdx("gia ban");
  const idxNgayBan = getColIdx("ngày bán") !== -1 ? getColIdx("ngày bán") : getColIdx("ngay ban");
  const idxHanBh = getColIdx("thời gian bh") !== -1 ? getColIdx("thời gian bh") : getColIdx("bh");
  const idxHetBh = getColIdx("hết bh") !== -1 ? getColIdx("hết bh") : getColIdx("het bh");
  const idxSerial = getColIdx("serial");

  if (idxTen === -1 || idxGiaNhap === -1) {
    console.error("❌ Cột 'Tên mặt hàng' hoặc 'Giá nhập' không tồn tại trong file.");
    process.exit(1);
  }

  // 1. Get creator profile
  const adminProfiles = await db.select().from(schema.profiles).limit(1);
  const adminId = adminProfiles[0]?.id;
  if (!adminId) {
    console.error("❌ Không tìm thấy tài khoản quản trị nào trong bảng 'profiles'. Vui lòng đăng ký tài khoản trước.");
    process.exit(1);
  }
  console.log(`👤 Người thực hiện import: ${adminProfiles[0].fullName}`);

  // 2. Default Laptop category
  let laptopCategory = await db.query.categories.findFirst({
    where: eq(schema.categories.slug, "laptop")
  });
  if (!laptopCategory) {
    console.log("📦 Đang tạo danh mục mặc định 'Laptop'...");
    const [newCat] = await db.insert(schema.categories).values({
      name: "Laptop",
      slug: "laptop",
      description: "Máy tính xách tay"
    }).returning();
    laptopCategory = newCat;
  }

  // 3. Default Apple brand
  let appleBrand = await db.query.brands.findFirst({
    where: eq(schema.brands.name, "Apple")
  });
  if (!appleBrand) {
    console.log("🏷️ Đang tạo thương hiệu mặc định 'Apple'...");
    const [newBrand] = await db.insert(schema.brands).values({
      name: "Apple",
      logoUrl: null
    }).returning();
    appleBrand = newBrand;
  }

  // 4. Default Customer
  let defaultCustomer = await db.query.customers.findFirst({
    where: ilike(schema.customers.fullName, "%Khách lẻ Google Docs%")
  });
  if (!defaultCustomer) {
    console.log("👥 Đang tạo khách hàng mặc định 'Khách lẻ Google Docs'...");
    const [newCustomer] = await db.insert(schema.customers).values({
      fullName: "Khách lẻ Google Docs",
      phone: "",
      email: "",
      orderCount: 0,
      totalSpent: "0"
    }).returning();
    defaultCustomer = newCustomer;
  }

  console.log("⚡ Bắt đầu nạp dữ liệu vào Database...");
  let successCount = 0;

  await db.transaction(async (tx) => {
    // Process cells starting after the headerRowIdx
    for (let i = headerRowIdx + 1; i < rawLines.length; i++) {
      const cells = rawLines[i];
      if (!cells || cells.length === 0 || !cells[idxTen]) continue;

      const rowStt = cells[idxStt] !== undefined ? String(cells[idxStt]) : String(i - headerRowIdx);
      const rowId = cells[idxId] !== undefined ? String(cells[idxId]) : `GEN-${i - headerRowIdx}`;
      const name = String(cells[idxTen]).trim();
      
      // Skip helper rows or summary rows that don't represent products
      if (!name || name === "" || name === "0" || name.startsWith("Tổng") || name.startsWith("Cộng")) continue;

      const statusText = cells[idxTrangThai] !== undefined ? String(cells[idxTrangThai]).trim().toLowerCase() : "";
      
      const rawNgayNhap = cells[idxNgayNhap];
      const rawNgayNhan = cells[idxNgayNhan];
      const rawGiaNhap = cells[idxGiaNhap];
      const rawChiPhi = cells[idxChiPhi];
      const rawTongChiPhi = cells[idxTongChiPhi];
      const rawGiaBan = cells[idxGiaBan];
      const rawNgayBan = cells[idxNgayBan];
      const rawHanBh = cells[idxHanBh];
      const rawHetBh = cells[idxHetBh];
      const rawSerial = cells[idxSerial] !== undefined ? String(cells[idxSerial]).trim() : "";

      const giaNhap = parsePrice(rawGiaNhap);
      const chiPhi = parsePrice(rawChiPhi);
      const tongChiPhi = parsePrice(rawTongChiPhi) || (giaNhap + chiPhi);
      const giaBan = parsePrice(rawGiaBan);

      const ngayNhap = parseDateVal(rawNgayNhap);
      const ngayNhan = parseDateVal(rawNgayNhan) || ngayNhap;
      const ngayBan = parseDateVal(rawNgayBan);
      const ngayHetBh = parseDateVal(rawHetBh);
      
      const warrantyDays = parseInt(String(rawHanBh || ""), 10) || 7;

      let dbStatus: 'in_stock' | 'sold' | 'incoming' = 'in_stock';
      if (statusText.includes("bán") || statusText.includes("sold")) {
        dbStatus = 'sold';
      } else if (statusText.includes("chuyển") || statusText.includes("incoming") || statusText.includes("vận")) {
        dbStatus = 'incoming';
      }

      let currentBrandId = appleBrand.id;
      let currentCategoryId = laptopCategory.id;

      const productSlug = slugify(name);
      let product = await tx.query.products.findFirst({
        where: eq(schema.products.slug, productSlug)
      });

      if (!product) {
        const specs = extractSpecs(name);
        const [newProduct] = await tx.insert(schema.products).values({
          name,
          slug: productSlug,
          brandId: currentBrandId,
          categoryId: currentCategoryId,
          specs: specs,
          warrantyMonths: 12,
          isActive: true
        }).returning();
        product = newProduct;
      }

      const finalSerial = rawSerial && rawSerial !== "" ? rawSerial : `TG-IMPORT-${rowId}-${i}`;

      const existingItem = await tx.query.inventoryItems.findFirst({
        where: eq(schema.inventoryItems.serialNumber, finalSerial)
      });

      if (existingItem) {
        console.log(`⚠️ Bỏ qua dòng STT ${rowStt}: Serial "${finalSerial}" đã tồn tại.`);
        continue;
      }

      const warrantyMonths = Math.ceil(warrantyDays / 30) || 12;
      const warrantyStart = ngayBan || ngayNhan || new Date();
      const warrantyEnd = ngayHetBh || new Date(warrantyStart.getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      // Insert Inventory Item
      const [insertedItem] = await tx.insert(schema.inventoryItems).values({
        serialNumber: finalSerial,
        productId: product.id,
        condition: 'used',
        status: dbStatus,
        costPrice: String(tongChiPhi),
        sellingPrice: String(giaBan || 0),
        receivedDate: ngayNhap ? ngayNhap.toISOString().split("T")[0] : null,
        stockedDate: ngayNhan ? ngayNhan.toISOString().split("T")[0] : null,
        soldDate: dbStatus === 'sold' && ngayBan ? ngayBan.toISOString().split("T")[0] : null,
        warrantyStart: dbStatus === 'sold' ? warrantyStart.toISOString().split("T")[0] : null,
        warrantyEnd: dbStatus === 'sold' ? warrantyEnd.toISOString().split("T")[0] : null,
        notes: `Imported từ Google Docs (ID: ${rowId})`,
        createdBy: adminId
      }).returning();

      // Financial record sync if sold
      if (dbStatus === 'sold') {
        const orderNumber = `DH-GD-${rowId}-${i}`;
        const orderDate = ngayBan || ngayNhan || new Date();

        const [insertedOrder] = await tx.insert(schema.orders).values({
          orderNumber,
          customerId: defaultCustomer.id,
          status: 'completed',
          saleChannel: 'offline',
          subtotal: String(giaBan),
          discountAmount: "0",
          totalAmount: String(giaBan),
          totalCost: String(tongChiPhi),
          profit: String(giaBan - tongChiPhi),
          profitMargin: String(Math.round(((giaBan - tongChiPhi) / giaBan) * 100)),
          paymentStatus: 'paid',
          paymentMethod: 'bank_transfer',
          soldBy: adminId,
          createdAt: orderDate,
          updatedAt: orderDate
        }).returning();

        await tx.insert(schema.orderItems).values({
          orderId: insertedOrder.id,
          inventoryItemId: insertedItem.id,
          productId: product.id,
          sellingPrice: String(giaBan),
          costPrice: String(tongChiPhi),
          warrantyMonths: warrantyMonths,
          isGift: false
        });

        await tx.insert(schema.payments).values({
          orderId: insertedOrder.id,
          amount: String(giaBan),
          paymentMethod: 'bank_transfer',
          paymentDate: orderDate,
          notes: "Import tự động từ Google Docs",
          createdBy: adminId
        });

        await tx.insert(schema.cashBookEntries).values({
          entryNumber: `PT-GD-${rowId}-${i}`,
          type: 'income',
          category: 'sales',
          amount: String(giaBan),
          runningBalance: "0",
          paymentMethod: 'bank_transfer',
          referenceType: 'order',
          referenceId: insertedOrder.id,
          description: `Thu tiền đơn hàng ${orderNumber} - ${name} (${finalSerial})`,
          entryDate: orderDate.toISOString().split("T")[0],
          createdBy: adminId,
          createdAt: orderDate
        });
      }

      successCount++;
    }

    console.log("🧮 Đang tính toán lại số dư lũy kế của sổ quỹ...");
    await recalculateRunningBalances(tx);
  });

  console.log(`\n🎉 HOÀN THÀNH: Đã nạp thành công ${successCount} dòng sản phẩm từ Excel/CSV!`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Lỗi xảy ra trong quá trình nạp dữ liệu:", err);
    process.exit(1);
  });
