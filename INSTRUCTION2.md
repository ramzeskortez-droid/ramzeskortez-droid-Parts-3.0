
/**
 * КОНФИГУРАЦИЯ
 */
const TELEGRAM_TOKEN = '8584425867:AAFbjHHrSLYx6hdiXnNaaBx2dR7cD9NG2jw';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

// URL вебхука Битрикс24
const B24_WEBHOOK_URL = "https://drave5inb2.temp.swtest.ru/rest/1/zt6j93x9rzn0jhtc/";

// КОЛОНКИ:
// A(0): ID
// B(1): Parent ID
// C(2): Тип
// D(3): Статус
// E(4): VIN
// F(5): Имя
// G(6): Сводка
// H(7): JSON
// I(8): ЧПУ Статус (Rich Text)
// J(9): Дата
// K(10): Локация
// L(11): ОБРАБОТАН
// M(12): ГОТОВ КУПИТЬ (Y/N)

/**
 * ТОЧКА ВХОДА GET
 */
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getData') {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName('MarketData');
    if (!sheet) return response([]);
    
    // Получаем все данные
    const data = sheet.getDataRange().getValues();
    // Отсекаем заголовки
    const rows = data.slice(1);
    
    // Мапим в объект
    return response(rows.map(r => ({
      id: r[0], parentId: r[1], type: r[2], status: r[3], vin: r[4], 
      clientName: r[5], summary: r[6], json: r[7], rank: r[8], 
      createdAt: r[9], location: r[10], processed: r[11], readyToBuy: r[12]
    })));
  }
  return response({status: "alive", version: "3.5-purchase-integrated"});
}

/**
 * ТОЧКА ВХОДА POST
 */
function doPost(e) {
  if (!e || !e.postData) return response({error: "No post data"});
  
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); 
  
  try {
    const contents = JSON.parse(e.postData.contents);
    const doc = SpreadsheetApp.getActiveSpreadsheet();

    // --- TELEGRAM ---
    if (contents.message || contents.callback_query) {
      const subSheet = getOrCreateSheet(doc, 'Subscribers', ['ChatID', 'Username', 'Date']);
      handleTelegramUpdate(contents, subSheet);
      return response({status: 'telegram_ok'});
    }

    // --- MARKET DATA ---
    const sheet = getOrCreateSheet(doc, 'MarketData', [
      'ID', 'Parent ID', 'Тип', 'Статус', 'VIN', 'Имя', 'Сводка', 'JSON', 'Детали/Цены', 'Дата', 'Локация', 'ОБРАБОТАН', 'ГОТОВ КУПИТЬ'
    ]);
    const body = contents;

    // 1. СОЗДАНИЕ ЗАКАЗА
    if (body.action === 'create' && body.order.type === 'ORDER') {
      const o = body.order;
      const itemsJson = JSON.stringify(o.items);
      const summary = (o.items || []).map(i => `${i.name} (${i.quantity})`).join(', ');
      const formattedDate = (o.createdAt || '').replace(', ', '\n');
      const readableStatus = generateOrderSummary(o.items);

      const rowData = [
        o.id, '', 'ORDER', o.status, o.vin, o.clientName, summary, itemsJson, readableStatus, formattedDate, o.location, 'N', 'N'
      ];
      
      sheet.insertRowAfter(1);
      sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
      
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(formatNewOrderMessage(o), subSheet);

      // Интеграция Б24
      addLeadWithTg(o);
    } 

    // 2. СОЗДАНИЕ ПРЕДЛОЖЕНИЯ
    else if (body.action === 'create' && body.order.type === 'OFFER') {
      const o = body.order;
      const itemsJson = JSON.stringify(o.items);
      const readableStatus = generateOfferSummary(o.items); 
      const formattedDate = (o.createdAt || '').replace(', ', '\n');

      const rowData = [
        o.id, o.parentId, 'OFFER', o.status, o.vin, o.clientName, 'Предложение', itemsJson, readableStatus, formattedDate, o.location, 'N', 'N'
      ];

      const insertionIndex = findBlockEndIndex(sheet, o.parentId);
      sheet.insertRowAfter(insertionIndex);
      sheet.getRange(insertionIndex + 1, 1, 1, rowData.length).setValues([rowData]);

      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(`💰 <b>НОВОЕ ПРЕДЛОЖЕНИЕ</b>\nК заказу: <code>${o.parentId}</code>\nПоставщик: <b>${o.clientName}</b>`, subSheet);
    } 
    
    // 3. ОБНОВЛЕНИЕ РАНГА
    else if (body.action === 'update_rank') {
      handleRankUpdate(sheet, body);
    } 
    
    // 4. ФОРМИРОВАНИЕ КП
    else if (body.action === 'form_cp') {
      updateStatusById(sheet, body.orderId, 12, 'Y'); 
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(`✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${body.orderId}</code>`, subSheet);
    } 
    
    // 5. ПОДТВЕРЖДЕНИЕ ПОКУПКИ (НОВОЕ)
    else if (body.action === 'confirm_purchase') {
      handlePurchaseConfirmation(sheet, body.orderId);
    }

    // 6. ЗАКРЫТИЕ
    else if (body.action === 'close_order') {
      closeOrderInSheet(sheet, body.orderId);
    }

    // Финальное форматирование
    formatSheetStyles(sheet);

    return response({status: 'ok'});

  } catch (err) {
    return response({error: err.toString()});
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * ЛОГИКА ПОДТВЕРЖДЕНИЯ ПОКУПКИ
 */
function handlePurchaseConfirmation(sheet, orderId) {
  // 1. Ставим отметку в таблице (Колонка M - индекс 12)
  updateStatusById(sheet, orderId, 13, 'Y');

  // 2. Собираем данные для ТГ
  const data = sheet.getDataRange().getValues();
  let orderRow = null;
  const winnerItems = [];
  let totalSum = 0;
  let currency = '₽';

  // Ищем строку заказа
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(orderId)) {
      orderRow = data[i];
      break;
    }
  }

  if (!orderRow) return;

  // Ищем все ЛИДЕР-позиции в связанных офферах
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(orderId) && data[i][2] === 'OFFER') {
      try {
        const items = JSON.parse(data[i][7]);
        items.forEach(item => {
          if (item.rank === 'ЛИДЕР') {
            const price = item.adminPrice || item.sellerPrice || 0;
            const qty = item.offeredQuantity || item.quantity || 1;
            winnerItems.push({
              name: item.name,
              category: item.category || 'Запчасть',
              price: price,
              qty: qty,
              total: price * qty
            });
            totalSum += (price * qty);
            const curr = item.adminCurrency || item.sellerCurrency || 'RUB';
            currency = curr === 'USD' ? '$' : curr === 'CNY' ? '¥' : '₽';
          }
        });
      } catch(e) {}
    }
  }

  // 3. Формируем сообщение
  let carStr = "Авто не указано";
  try {
    const items = JSON.parse(orderRow[7]);
    if (items[0] && items[0].car) {
      const c = items[0].car;
      carStr = (c.model || '') + ' ' + (c.year || '');
    }
  } catch(e) {}

  let msg = `🛍 <b>КЛИЕНТ ГОТОВ КУПИТЬ</b>\n`;
  msg += `Заказ: <code>${orderId}</code> (Клиент: <b>${orderRow[5]}</b>)\n`;
  msg += `Авто: <b>${carStr}</b>\n\n`;
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  
  winnerItems.forEach((item, idx) => {
    msg += `${idx + 1}. ${item.name} (${item.category}) — <b>${item.price.toLocaleString()}${currency}</b> x ${item.qty}\n`;
  });
  
  msg += `\n💰 <b>ИТОГО К ОПЛАТЕ: ${totalSum.toLocaleString()} ${currency}</b>`;

  const subSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Subscribers');
  broadcastMessage(msg, subSheet);
}

/**
 * ИНТЕГРАЦИЯ С БИТРИКС24
 */
function addLeadWithTg(order) {
  var carModel = "Авто не указано";
  if (order.items && order.items.length > 0 && order.items[0].car) {
     var c = order.items[0].car;
     carModel = c.model || "Модель?";
  }
  var rawTitle = carModel + " | " + (order.clientName || "Клиент") + " | " + (order.vin || "Без VIN");
  var leadTitle = encodeURIComponent(rawTitle);
  var clientName = encodeURIComponent(order.clientName || "Неизвестный");
  var comments = encodeURIComponent("VIN: " + (order.vin || "-") + "\nЛокация: " + (order.location || "-"));
  
  try {
    var leadUrl = B24_WEBHOOK_URL + "crm.lead.add?fields[TITLE]=" + leadTitle + "&fields[NAME]=" + clientName + "&fields[COMMENTS]=" + comments + "&fields[STATUS_ID]=NEW&fields[OPENED]=Y"; 
    var options = { "method": "get", "validateHttpsCertificates": false, "muteHttpExceptions": true };
    var leadResponse = UrlFetchApp.fetch(leadUrl, options);
    var leadJson = JSON.parse(leadResponse.getContentText());
    if (!leadJson.result) return;
    var newLeadId = leadJson.result;

    if (order.items && order.items.length > 0) {
      var productParams = "?id=" + newLeadId;
      for (var i = 0; i < order.items.length; i++) {
        var item = order.items[i];
        var details = [];
        if(item.category) details.push(item.category);
        if(item.color) details.push(item.color);
        var detailString = details.length > 0 ? " (" + details.join(", ") + ")" : "";
        var pName = encodeURIComponent((item.name || "Деталь") + detailString);
        var pQty = item.quantity || 1;
        var pPrice = item.price || 0; 
        productParams += "&rows[" + i + "][PRODUCT_NAME]=" + pName + "&rows[" + i + "][PRICE]=" + pPrice + "&rows[" + i + "][QUANTITY]=" + pQty + "&rows[" + i + "][CURRENCY_ID]=RUB" + "&rows[" + i + "][PRODUCT_ID]=0";
      }
      UrlFetchApp.fetch(B24_WEBHOOK_URL + "crm.lead.productrows.set" + productParams, options);
    }
  } catch (e) { Logger.log(e.toString()); }
}

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
function handleRankUpdate(sheet, body) {
  const { vin, detailName, leadOfferId, adminPrice, adminCurrency } = body;
  const data = sheet.getDataRange().getValues();
  let parentId = null;
  let offerRowIndex = -1;
  let orderRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(leadOfferId)) {
      offerRowIndex = i;
      parentId = data[i][1];
      break;
    }
  }
  if (!parentId) return;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(parentId)) { orderRowIndex = i; break; }
  }
  if (offerRowIndex !== -1) {
    let items = [];
    try { items = JSON.parse(data[offerRowIndex][7]); } catch(e) {}
    let changed = false;
    items = items.map(item => {
      if (item.name.trim().toLowerCase() === detailName.trim().toLowerCase()) {
        changed = true;
        item.rank = 'ЛИДЕР'; 
        if (adminPrice !== undefined) item.adminPrice = adminPrice;
        if (adminCurrency !== undefined) item.adminCurrency = adminCurrency;
      }
      return item;
    });
    if (changed) {
      sheet.getRange(offerRowIndex + 1, 8).setValue(JSON.stringify(items));
      sheet.getRange(offerRowIndex + 1, 9).setValue(generateOfferSummary(items));
    }
  }
  const allLeaderItems = [];
  let carInfo = null;
  if (orderRowIndex !== -1) {
      try {
          const orderItems = JSON.parse(data[orderRowIndex][7]);
          if (orderItems.length > 0 && orderItems[0].car) carInfo = orderItems[0].car;
      } catch(e) {}
  }
  const freshData = sheet.getDataRange().getValues();
  for (let i = 1; i < freshData.length; i++) {
      if ((String(freshData[i][1]) === String(parentId) && freshData[i][2] === 'OFFER')) {
         let oItems = [];
         try { oItems = JSON.parse(freshData[i][7]); } catch(e) { continue; }
         let modified = false;
         oItems.forEach(item => {
             if (item.name.trim().toLowerCase() === detailName.trim().toLowerCase() && String(freshData[i][0]) !== String(leadOfferId)) {
                 if (item.rank === 'ЛИДЕР') { item.rank = 'РЕЗЕРВ'; modified = true; }
             }
             if (item.rank === 'ЛИДЕР') allLeaderItems.push(item);
         });
         if (modified) {
             sheet.getRange(i + 1, 8).setValue(JSON.stringify(oItems));
             sheet.getRange(i + 1, 9).setValue(generateOfferSummary(oItems));
         }
      }
  }
  if (orderRowIndex !== -1) {
      const orderSummary = generateFinalOrderReceipt(carInfo, allLeaderItems);
      sheet.getRange(orderRowIndex + 1, 9).setValue(orderSummary);
  }
}

function generateOfferSummary(items) {
  if (!items || items.length === 0) return '';
  let lines = [];
  items.forEach(item => {
    let icon = '⬜';
    if (item.available === false) icon = '❌';
    else if (item.rank === 'ЛИДЕР') icon = '✅'; 
    else if (item.available) icon = '🟨';
    const price = item.sellerPrice || 0;
    const curr = item.sellerCurrency || 'RUB';
    const sym = curr === 'USD' ? '$' : curr === 'CNY' ? '¥' : '₽';
    let priceStr = price > 0 ? ` | ${price}${sym}` : '';
    lines.push(`${icon} | ${item.name} | ${item.quantity}шт${priceStr}`);
  });
  return lines.join('\n');
}

function generateFinalOrderReceipt(car, leaderItems) {
    let lines = [];
    if (car) lines.push(`${car.model || ''} ${car.bodyType || ''} ${car.year || ''}`.trim());
    else lines.push("АВТО НЕ УКАЗАНО");
    if (!leaderItems || leaderItems.length === 0) { lines.push("(Нет выбранных позиций)"); return lines.join('\n'); }
    leaderItems.forEach(item => {
        const price = item.adminPrice || item.sellerPrice || 0;
        const curr = item.adminCurrency || item.sellerCurrency || 'RUB';
        const sym = curr === 'USD' ? '$' : curr === 'CNY' ? '¥' : '₽';
        lines.push(`✅ | ${item.name} | ${item.quantity}шт | ${price}${sym}`);
    });
    return lines.join('\n');
}

function generateOrderSummary(items) {
    if (!items) return '';
    let lines = [];
    if (items[0] && items[0].car) {
        const c = items[0].car;
        lines.push(`${c.model || ''} ${c.year || ''}`);
    }
    items.forEach(i => lines.push(`⬜ | ${i.name} | ${i.quantity}шт`));
    return lines.join('\n');
}

function findBlockEndIndex(sheet, parentId) {
  const data = sheet.getDataRange().getValues();
  let lastIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(parentId) || String(data[i][1]) === String(parentId)) lastIndex = i + 1;
    else if (lastIndex !== -1) break; 
  }
  return lastIndex === -1 ? sheet.getLastRow() : lastIndex;
}

function formatSheetStyles(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  sheet.setColumnWidth(9, 250); 
  sheet.autoResizeColumn(10);   
  sheet.getRange(2, 8, lastRow - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor("#cccccc"); 
  sheet.getRange(2, 9, lastRow - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.getRange(2, 1, lastRow - 1, 13).setVerticalAlignment("middle");
  const data = sheet.getDataRange().getValues();
  let blockStartRow = -1;
  const styleBlock = (startRow, endRow, isProcessed) => {
    const numRows = endRow - startRow + 1;
    const blockRange = sheet.getRange(startRow, 1, numRows, 13);
    blockRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    blockRange.setBorder(true, true, true, true, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    if (isProcessed) blockRange.setBackground('#e8f5e9');
    else {
      sheet.getRange(startRow, 1, 1, 13).setBackground('#fff9c4');
      if (numRows > 1) sheet.getRange(startRow + 1, 1, numRows - 1, 13).setBackground('#ffffff');
    }
  };
  for (let i = 1; i < data.length; i++) {
    const rowIdx = i + 1;
    if (data[i][2] === 'ORDER') {
      if (blockStartRow !== -1) styleBlock(blockStartRow, rowIdx - 1, data[blockStartRow - 1][11] === 'Y');
      blockStartRow = rowIdx;
    }
  }
  if (blockStartRow !== -1) styleBlock(blockStartRow, lastRow, data[blockStartRow - 1][11] === 'Y');
}

function handleTelegramUpdate(contents, subSheet) {
  const msg = contents.message;
  if (!msg || !msg.text) return;
  const chatId = String(msg.chat.id);
  if (msg.text.trim() === '/start') {
    const data = subSheet.getDataRange().getValues();
    if (!data.some(r => String(r[0]) === chatId)) subSheet.appendRow([chatId, msg.from.username || 'User', new Date()]);
  }
}

function closeOrderInSheet(sheet, orderId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(orderId) || String(data[i][1]) === String(orderId)) {
      sheet.getRange(i + 1, 4).setValue('ЗАКРЫТ');
    }
  }
}

function updateStatusById(sheet, id, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) sheet.getRange(i + 1, colIndex).setValue(value);
  }
}

function broadcastMessage(html, subSheet) {
  if (!subSheet) return;
  const data = subSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0]) sendTelegramText(String(data[i][0]), html); }
}

function sendTelegramText(chatId, text) {
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
}

function getOrCreateSheet(doc, name, headers) {
  let s = doc.getSheetByName(name);
  if (!s) { s = doc.insertSheet(name); s.appendRow(headers); s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e5e7eb"); s.setFrozenRows(1); }
  return s;
}

function response(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function formatNewOrderMessage(order) {
  return `🔥 <b>НОВЫЙ ЗАКАЗ</b>\nID: <code>${order.id}</code>\nКлиент: <b>${order.clientName}</b>\nVIN: <code>${order.vin}</code>\n\n🌍 <a href="${WEBAPP_URL}">Открыть Маркетплейс</a>`;
}
