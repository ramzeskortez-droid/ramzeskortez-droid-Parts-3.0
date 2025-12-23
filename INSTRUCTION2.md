
/**
 * КОНФИГУРАЦИЯ
 */
const TELEGRAM_TOKEN = '8584425867:AAFbjHHrSLYx6hdiXnNaaBx2dR7cD9NG2jw';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

// URL вебхука Битрикс24
const B24_WEBHOOK_URL = "https://drave5inb2.temp.swtest.ru/rest/1/zt6j93x9rzn0jhtc/";
const B24_BASE_URL = "https://drave5inb2.temp.swtest.ru";

/**
 * ТОЧКА ВХОДА GET
 */
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getData') {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName('MarketData');
    if (!sheet) return response([]);
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    
    return response(rows.map(r => ({
      id: r[0], parentId: r[1], type: r[2], status: r[3], vin: r[4], 
      clientName: r[5], summary: r[6], json: r[7], rank: r[8], 
      createdAt: r[9], location: r[10], processed: r[11], readyToBuy: r[12]
    })));
  }
  return response({status: "alive", version: "3.9.7-b24-force-get"});
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

    if (contents.message || contents.callback_query) {
      const subSheet = getOrCreateSheet(doc, 'Subscribers', ['ChatID', 'Username', 'Date']);
      handleTelegramUpdate(contents, subSheet);
      return response({status: 'telegram_ok'});
    }

    const sheet = getOrCreateSheet(doc, 'MarketData', [
      'ID', 'Parent ID', 'Тип', 'Статус', 'VIN', 'Имя', 'Сводка', 'JSON', 'Детали/Цены', 'Дата', 'Локация', 'ОБРАБОТАН', 'ГОТОВ КУПИТЬ'
    ]);
    const body = contents;

    if (body.action === 'create' && body.order.type === 'ORDER') {
      const o = body.order;
      const itemsJson = JSON.stringify(o.items);
      const summary = (o.items || []).map(i => `${i.name} (${i.quantity} шт)`).join(', ');
      const formattedDate = (o.createdAt || '').replace(', ', '\n');
      const readableStatus = generateOrderSummary(o.items);

      const rowData = [
        o.id, '', 'ORDER', o.status, o.vin, o.clientName, summary, itemsJson, readableStatus, formattedDate, o.location, 'N', 'N'
      ];
      
      sheet.insertRowAfter(1);
      sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
      
      // Попытка создания лида (FORCE GET)
      var b24Result = addLeadWithTg(o);
      
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(formatNewOrderMessage(o, b24Result), subSheet);
    } 
    else if (body.action === 'create' && body.order.type === 'OFFER') {
      const o = body.order;
      const itemsJson = JSON.stringify(o.items);
      const rowData = [o.id, o.parentId, 'OFFER', o.status, o.vin, o.clientName, 'Предложение', itemsJson, generateOfferSummary(o.items), (o.createdAt || '').replace(', ', '\n'), o.location, 'N', 'N'];
      const insertionIndex = findBlockEndIndex(sheet, o.parentId);
      sheet.insertRowAfter(insertionIndex);
      sheet.getRange(insertionIndex + 1, 1, 1, rowData.length).setValues([rowData]);
      broadcastMessage(`💰 <b>НОВОЕ ПРЕДЛОЖЕНИЕ</b>\nК заказу: <code>${o.parentId}</code>\nПоставщик: <b>${o.clientName}</b>`, doc.getSheetByName('Subscribers'));
    }
    else if (body.action === 'form_cp') {
      updateStatusById(sheet, body.orderId, 12, 'Y'); 
      const orderData = findOrderById(sheet, body.orderId);
      broadcastMessage(orderData ? formatCPMessage(body.orderId, orderData) : `✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${body.orderId}</code>`, doc.getSheetByName('Subscribers'));
    }
    else if (body.action === 'confirm_purchase') {
      handlePurchaseConfirmation(sheet, body.orderId);
    }
    else if (body.action === 'close_order') {
      closeOrderInSheet(sheet, body.orderId);
    }

    formatSheetStyles(sheet);
    return response({status: 'ok'});
  } catch (err) {
    return response({error: err.toString()});
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * ПРИНУДИТЕЛЬНАЯ ИНТЕГРАЦИЯ ЧЕРЕЗ GET (ДЛЯ ОБХОДА БЛОКИРОВОК)
 */
function addLeadWithTg(order) {
  var carModel = "Авто не указано";
  if (order.items && order.items.length > 0 && order.items[0].car) { 
    carModel = order.items[0].car.model || "Модель?"; 
  }

  var rawTitle = carModel + " | " + (order.clientName || "Клиент") + " | " + (order.vin || "Без VIN");
  var leadTitle = encodeURIComponent(rawTitle);
  var clientName = encodeURIComponent(order.clientName || "Неизвестный");
  var comments = encodeURIComponent("Заказ: " + order.id + "\nVIN: " + (order.vin || "-") + "\nЛокация: " + (order.location || "-"));

  var options = { 
    "method": "get", 
    "validateHttpsCertificates": false, 
    "muteHttpExceptions": true 
  };

  try {
    // 1. Создание лида через GET
    var leadUrl = B24_WEBHOOK_URL + "crm.lead.add" + 
                  "?fields[TITLE]=" + leadTitle + 
                  "&fields[NAME]=" + clientName + 
                  "&fields[COMMENTS]=" + comments +
                  "&fields[STATUS_ID]=NEW" + 
                  "&fields[OPENED]=Y"; 

    var leadResponse = UrlFetchApp.fetch(leadUrl, options);
    var leadJson = JSON.parse(leadResponse.getContentText());
    
    if (!leadJson.result) {
      Logger.log("B24 GET Error: " + leadResponse.getContentText());
      return { error: leadJson.error_description || leadJson.error || "Ошибка GET-запроса" };
    }
    
    var newLeadId = leadJson.result;

    // 2. Добавление товаров через GET
    if (order.items && order.items.length > 0) {
      var productParams = "?id=" + newLeadId;

      for (var i = 0; i < order.items.length; i++) {
        var item = order.items[i];
        var pName = encodeURIComponent((item.name || "Деталь") + (item.category ? " ("+item.category+")" : ""));
        var pQty = item.quantity || 1;
        var pPrice = item.price || 0; 

        productParams += "&rows[" + i + "][PRODUCT_NAME]=" + pName +
                         "&rows[" + i + "][PRICE]=" + pPrice +
                         "&rows[" + i + "][QUANTITY]=" + pQty +
                         "&rows[" + i + "][CURRENCY_ID]=RUB" +
                         "&rows[" + i + "][PRODUCT_ID]=0";
      }
      
      UrlFetchApp.fetch(B24_WEBHOOK_URL + "crm.lead.productrows.set" + productParams, options);
    }

    return { id: newLeadId }; 
  } catch (e) { 
    return { error: e.toString() }; 
  }
}

/**
 * ФОРМАТ СООБЩЕНИЯ О ЗАКАЗЕ
 */
function formatNewOrderMessage(order, b24Result) {
  let msg = `🔥 <b>НОВЫЙ ЗАКАЗ</b>\n`;
  msg += `ID: <code>${order.id}</code>\n`;
  msg += `Клиент: <b>${order.clientName}</b>\n`;
  msg += `VIN: <code>${order.vin}</code>\n\n`;
  
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  if (order.items && order.items.length > 0) {
    order.items.forEach((item) => {
      msg += `• ${item.name} (${item.category || 'Запчасть'}) — ${item.quantity} шт\n`;
    });
  }
  msg += `\n`;

  if (b24Result && b24Result.id) {
    const carModel = (order.items && order.items[0] && order.items[0].car) ? order.items[0].car.model : "Лид";
    const leadName = `${carModel} | ${order.clientName}`;
    msg += `🚀 <a href="${B24_BASE_URL}/crm/lead/details/${b24Result.id}/">${leadName}</a> в Б24`;
  } else if (b24Result && b24Result.error) {
    msg += `⚠️ <b>ОШИБКА CRM (GET):</b> <i>${b24Result.error}</i>`;
  } else {
    msg += `⚠️ <i>Лид в CRM не создан</i>`;
  }
  
  return msg;
}

// ... остальные функции (generateOrderSummary, generateOfferSummary, и т.д.) ...
function generateOrderSummary(items) {
    if (!items) return '';
    let lines = [];
    if (items[0] && items[0].car) { lines.push(`${items[0].car.model || ''} ${items[0].car.year || ''}`); }
    items.forEach(i => lines.push(`⬜ | ${i.name} | ${i.quantity} шт`));
    return lines.join('\n');
}
function generateOfferSummary(items) {
  if (!items || items.length === 0) return '';
  let lines = [];
  items.forEach(item => {
    let icon = (item.available === false) ? '❌' : (item.rank === 'ЛИДЕР') ? '✅' : '⬜';
    lines.push(`${icon} | ${item.name} | ${item.quantity} шт`);
  });
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
  sheet.getRange(2, 1, lastRow - 1, 13).setVerticalAlignment("middle");
}
function getOrCreateSheet(doc, name, headers) {
  let s = doc.getSheetByName(name);
  if (!s) { s = doc.insertSheet(name); s.appendRow(headers); s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e5e7eb"); s.setFrozenRows(1); }
  return s;
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
function sendTelegramText(chatId, text) {
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
}
function broadcastMessage(html, subSheet) {
  if (!subSheet) return;
  const data = subSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0]) sendTelegramText(String(data[i][0]), html); }
}
function response(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function findOrderById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(id)) return data[i]; }
  return null;
}
function updateStatusById(sheet, id, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(id)) sheet.getRange(i + 1, colIndex).setValue(value); }
}
function closeOrderInSheet(sheet, orderId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(orderId) || String(data[i][1]) === String(orderId)) { sheet.getRange(i + 1, 4).setValue('ЗАКРЫТ'); } }
}
function handlePurchaseConfirmation(sheet, orderId) {
  updateStatusById(sheet, orderId, 13, 'Y');
}
function formatCPMessage(orderId, orderRow) {
  let msg = `✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${orderId}</code>\n`;
  return msg;
}
