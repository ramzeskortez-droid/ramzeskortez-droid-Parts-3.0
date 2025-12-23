
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
  return response({status: "alive", version: "4.0.2-purchase-notifications"});
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
      
      const offerNum = countOffersForOrder(sheet, o.parentId);
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(`💰 <b>НОВОЕ ПРЕДЛОЖЕНИЕ (№${offerNum})</b>\nК заказу: <code>${o.parentId}</code>\nПоставщик: <b>${o.clientName}</b>`, subSheet);
    }
    else if (body.action === 'form_cp') {
      updateStatusById(sheet, body.orderId, 12, 'Y'); 
      const orderRow = findOrderRowById(sheet, body.orderId);
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(orderRow ? formatCPMessage(body.orderId, orderRow) : `✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${body.orderId}</code>`, subSheet);
    }
    else if (body.action === 'confirm_purchase') {
      handlePurchaseConfirmation(sheet, body.orderId);
      const orderRow = findOrderRowById(sheet, body.orderId);
      if (orderRow) {
        const subSheet = doc.getSheetByName('Subscribers');
        broadcastMessage(formatPurchaseConfirmationMessage(body.orderId, orderRow), subSheet);
      }
    }
    else if (body.action === 'close_order') {
      closeOrderInSheet(sheet, body.orderId);
    }
    else if (body.action === 'update_rank') {
      handleRankUpdate(sheet, body);
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
 * ФОРМАТ КП ДЛЯ ТЕЛЕГРАМА (РАСШИРЕННЫЙ)
 */
function formatCPMessage(orderId, row) {
  const details = String(row[8] || '');
  const lines = details.split('\n');
  
  let msg = `✅ <b>КП СФОРМИРОВАНО</b>\n`;
  msg += `Заказ: <code>${orderId}</code>\n`;
  msg += `Имя клиента: <b>${row[5]}</b>\n`;
  msg += `<b>${lines[0]}</b>\n\n`;
  
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  
  lines.forEach((line, idx) => {
    if (idx === 0) return; 
    if (line.includes('✅')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4) {
        msg += `• ${parts[1]} — ${parts[3]} x ${parts[2]}\n`;
      }
    }
  });

  return msg;
}

/**
 * ФОРМАТ ПОДТВЕРЖДЕНИЯ ПОКУПКИ (С РАСЧЕТОМ ИТОГО)
 */
function formatPurchaseConfirmationMessage(orderId, row) {
  const details = String(row[8] || '');
  const lines = details.split('\n');
  
  let msg = `🛍 <b>КЛИЕНТ ГОТОВ КУПИТЬ</b>\n`;
  msg += `Заказ: <code>${orderId}</code>\n`;
  msg += `Клиент: <b>${row[5]}</b>\n`;
  msg += `Авто: <b>${lines[0]}</b>\n\n`;
  
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  let total = 0;
  
  lines.forEach((line, idx) => {
    if (idx === 0) return; 
    if (line.includes('✅')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4) {
        msg += `• ${parts[1]} — ${parts[3]} x ${parts[2]}\n`;
        
        // Парсим цену и количество для ИТОГО
        const priceNum = parseInt(parts[3].replace(/\D/g, '')) || 0;
        const qtyNum = parseInt(parts[2].replace(/\D/g, '')) || 1;
        total += priceNum * qtyNum;
      }
    }
  });

  msg += `\n<b>ИТОГО: ${total.toLocaleString('ru-RU')} руб.</b>`;
  return msg;
}

/**
 * ФОРМАТ НОВОГО ЗАКАЗА
 */
function formatNewOrderMessage(order, b24Result) {
  let msg = `🔥 <b>НОВЫЙ ЗАКАЗ</b>\n`;
  msg += `ID: <code>${order.id}</code>\n`;
  msg += `Клиент: <b>${order.clientName}</b>\n`;
  msg += `VIN: <code>${order.vin}</code>\n\n`;
  
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  if (order.items) {
    order.items.forEach(i => msg += `• ${i.name} — ${i.quantity} шт\n`);
  }
  msg += `\n`;
  
  if (b24Result && b24Result.id) {
    msg += `🚀 <a href="${B24_BASE_URL}/crm/lead/details/${b24Result.id}/">${b24Result.title}</a>`;
  } else if (b24Result && b24Result.error) {
    msg += `⚠️ <b>ОШИБКА CRM:</b> <i>${b24Result.error}</i>`;
  } else {
    msg += `⚠️ <i>Лид в CRM не создан</i>`;
  }
  
  return msg;
}

/**
 * ПРИНУДИТЕЛЬНАЯ ИНТЕГРАЦИЯ ЧЕРЕЗ GET
 */
function addLeadWithTg(order) {
  var carModel = "Авто не указано";
  if (order.items && order.items.length > 0 && order.items[0].car) { 
    carModel = order.items[0].car.model || "Модель?"; 
  }
  var leadTitleText = carModel + " | " + (order.clientName || "Клиент");
  var rawTitle = leadTitleText + " | " + (order.vin || "Без VIN");
  var leadTitleEnc = encodeURIComponent(rawTitle);
  var clientName = encodeURIComponent(order.clientName || "Неизвестный");
  var comments = encodeURIComponent("Заказ: " + order.id + "\nVIN: " + (order.vin || "-") + "\nЛокация: " + (order.location || "-"));

  var options = { "method": "get", "validateHttpsCertificates": false, "muteHttpExceptions": true };
  try {
    var leadUrl = B24_WEBHOOK_URL + "crm.lead.add?fields[TITLE]=" + leadTitleEnc + "&fields[NAME]=" + clientName + "&fields[COMMENTS]=" + comments + "&fields[STATUS_ID]=NEW&fields[OPENED]=Y"; 
    var leadResponse = UrlFetchApp.fetch(leadUrl, options);
    var leadJson = JSON.parse(leadResponse.getContentText());
    if (!leadJson.result) return { error: leadJson.error_description || "Ошибка Б24" };
    var newLeadId = leadJson.result;

    if (order.items && order.items.length > 0) {
      var productParams = "?id=" + newLeadId;
      for (var i = 0; i < order.items.length; i++) {
        var item = order.items[i];
        productParams += "&rows[" + i + "][PRODUCT_NAME]=" + encodeURIComponent(item.name) + "&rows[" + i + "][PRICE]=0&rows[" + i + "][QUANTITY]=" + (item.quantity || 1) + "&rows[" + i + "][CURRENCY_ID]=RUB&rows[" + i + "][PRODUCT_ID]=0";
      }
      UrlFetchApp.fetch(B24_WEBHOOK_URL + "crm.lead.productrows.set" + productParams, options);
    }
    return { id: newLeadId, title: leadTitleText }; 
  } catch (e) { return { error: e.toString() }; }
}

function countOffersForOrder(sheet, parentId) {
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(parentId) && data[i][2] === 'OFFER') count++;
  }
  return count;
}

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
    if (String(data[i][0]) === String(parentId)) {
      orderRowIndex = i;
      break;
    }
  }

  if (offerRowIndex !== -1) {
    let items = JSON.parse(data[offerRowIndex][7] || '[]');
    items = items.map(item => {
      if (item.name.trim().toLowerCase() === detailName.trim().toLowerCase()) {
        item.rank = 'ЛИДЕР'; 
        if (adminPrice !== undefined) item.adminPrice = adminPrice;
        if (adminCurrency !== undefined) item.adminCurrency = adminCurrency;
      }
      return item;
    });
    sheet.getRange(offerRowIndex + 1, 8).setValue(JSON.stringify(items));
    sheet.getRange(offerRowIndex + 1, 9).setValue(generateOfferSummary(items));
  }
  
  const allLeaderItems = [];
  let carInfo = null;
  const freshData = sheet.getDataRange().getValues();
  for (let i = 1; i < freshData.length; i++) {
      if (String(freshData[i][1]) === String(parentId) && freshData[i][2] === 'OFFER') {
         let oItems = JSON.parse(freshData[i][7] || '[]');
         oItems.forEach(item => {
             if (item.rank === 'ЛИДЕР') allLeaderItems.push(item);
         });
      }
  }
  if (orderRowIndex !== -1) {
      try { carInfo = JSON.parse(freshData[orderRowIndex][7])[0].car; } catch(e){}
      sheet.getRange(orderRowIndex + 1, 9).setValue(generateFinalOrderReceipt(carInfo, allLeaderItems));
  }
}

function generateFinalOrderReceipt(car, leaderItems) {
    let lines = [car ? `${car.model} ${car.year}` : "АВТО"];
    leaderItems.forEach(item => {
        const price = item.adminPrice || item.sellerPrice || 0;
        const sym = (item.adminCurrency === 'USD') ? '$' : '₽';
        lines.push(`✅ | ${item.name} | ${item.quantity}шт | ${price}${sym}`);
    });
    return lines.join('\n');
}

function generateOrderSummary(items) {
    return items.map(i => `⬜ | ${i.name} | ${i.quantity} шт`).join('\n');
}

function generateOfferSummary(items) {
    return items.map(i => `${i.rank === 'ЛИДЕР' ? '✅' : '⬜'} | ${i.name} | ${i.quantity} шт`).join('\n');
}

function findOrderRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(id)) return data[i]; }
  return null;
}

function updateStatusById(sheet, id, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(id)) sheet.getRange(i + 1, colIndex).setValue(value); }
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

function getOrCreateSheet(doc, name, headers) {
  let s = doc.getSheetByName(name);
  if (!s) { s = doc.insertSheet(name); s.appendRow(headers); s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e5e7eb"); s.setFrozenRows(1); }
  return s;
}

function formatSheetStyles(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  sheet.setColumnWidth(9, 300);
  sheet.getRange(2, 9, lastRow-1, 1).setWrap(true);
}

function handleTelegramUpdate(contents, subSheet) {
  const msg = contents.message;
  if (msg && msg.text === '/start') {
    const chatId = String(msg.chat.id);
    const data = subSheet.getDataRange().getValues();
    if (!data.some(r => String(r[0]) === chatId)) subSheet.appendRow([chatId, msg.from.username || 'User', new Date()]);
  }
}

function broadcastMessage(html, subSheet) {
  if (!subSheet) return;
  const data = subSheet.getDataRange().getValues();
  data.slice(1).forEach(r => {
    if (r[0]) UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: String(r[0]), text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
  });
}

function response(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function closeOrderInSheet(sheet, orderId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(orderId) || String(data[i][1]) === String(orderId)) { sheet.getRange(i + 1, 4).setValue('ЗАКРЫТ'); } }
}
function handlePurchaseConfirmation(sheet, orderId) { updateStatusById(sheet, orderId, 13, 'Y'); }
