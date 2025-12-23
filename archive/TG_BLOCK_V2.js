/**
 * КОНФИГУРАЦИЯ
 */
const TELEGRAM_TOKEN = '8584425867:AAFbjHHrSLYx6hdiXnNaaBx2dR7cD9NG2jw';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

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
      createdAt: r[9], location: r[10], processed: r[11]
    })));
  }
  return response({status: "alive", version: "2.1-stable"});
}

/**
 * ТОЧКА ВХОДА POST
 */
function doPost(e) {
  // 1. Быстрая проверка данных
  if (!e || !e.postData) return response({error: "No post data"});
  
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(5000); // Ждем максимум 5 секунд
  
  try {
    const contents = JSON.parse(e.postData.contents);
    const doc = SpreadsheetApp.getActiveSpreadsheet();

    // --- ОБРАБОТКА TELEGRAM (Приоритет и скорость) ---
    if (contents.message || contents.callback_query) {
      const subSheet = getOrCreateSheet(doc, 'Subscribers', ['ChatID', 'Username', 'Date']);
      handleTelegramUpdate(contents, subSheet);
      return response({status: 'telegram_ok'}); // Быстрый ответ для ТГ
    }

    // --- ОБРАБОТКА REACT APP ---
    const sheet = getOrCreateSheet(doc, 'MarketData', [
      'ID', 'Parent ID', 'Тип', 'Статус', 'VIN', 'Имя', 'Сводка', 'JSON', 'Ранг', 'Дата', 'Локация', 'ОБРАБОТАН'
    ]);
    const body = contents;

    if (body.action === 'create') {
      const o = body.order;
      const itemsJson = JSON.stringify(o.items);
      let summary = (o.items || []).map(i => `${i.name} (${i.quantity})`).join(', ');

      const rowData = [
        o.id, 
        o.parentId || '', 
        o.type, 
        o.status, 
        o.vin, 
        o.clientName, 
        summary, 
        itemsJson, 
        (o.type === 'OFFER' ? 'РЕЗЕРВ' : ''), 
        o.createdAt, 
        o.location, 
        'N'
      ];
      
      sheet.appendRow(rowData);
      
      const subSheet = doc.getSheetByName('Subscribers');
      if (o.type === 'ORDER') {
        broadcastMessage(formatNewOrderMessage(o), subSheet);
      } else {
        broadcastMessage(`💰 <b>НОВОЕ ПРЕДЛОЖЕНИЕ</b>\nК заказу: <code>${o.parentId}</code>\nПоставщик: <b>${o.clientName}</b>`, subSheet);
      }
    } 
    
    else if (body.action === 'update_rank') {
      updateRankInSheet(sheet, body);
    } 
    
    else if (body.action === 'form_cp') {
      updateStatusById(sheet, body.orderId, 12, 'Y'); // Колонка L
      const subSheet = doc.getSheetByName('Subscribers');
      broadcastMessage(`✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${body.orderId}</code>`, subSheet);
    } 
    
    else if (body.action === 'close_order') {
      closeOrderInSheet(sheet, body.orderId);
    }

    formatRows(sheet);
    applyBorders(sheet);

    return response({status: 'ok'});

  } catch (err) {
    return response({error: err.toString()});
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * ЛОГИКА ТЕЛЕГРАМА (БЕЗ СПАМА)
 */
function handleTelegramUpdate(contents, subSheet) {
  const msg = contents.message;
  if (!msg || !msg.text) return;
  
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const username = msg.from.username || msg.from.first_name || 'User';

  if (text === '/start') {
    const data = subSheet.getDataRange().getValues();
    const exists = data.some(r => String(r[0]) === chatId);
    
    if (!exists) {
      subSheet.appendRow([chatId, username, new Date()]);
      sendTelegramText(chatId, `✅ <b>Вы подписаны на уведомления!</b>\nТеперь вы будете получать информацию о новых заказах.`);
    } 
    // Если "exists", мы ПРОСТО МОЛЧИМ. Это останавливает петлю ретраев Telegram.
  }
}

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
function updateRankInSheet(sheet, body) {
  const { detailName, leadOfferId } = body;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(leadOfferId)) {
      let items = [];
      try { items = JSON.parse(data[i][7]); } catch(e) {}
      let hasLeader = false;
      items = items.map(item => {
        if (item.name === detailName) item.rank = 'ЛИДЕР';
        if (item.rank === 'ЛИДЕР') hasLeader = true;
        return item;
      });
      sheet.getRange(i + 1, 8).setValue(JSON.stringify(items));
      sheet.getRange(i + 1, 9).setValue(hasLeader ? 'ЛИДЕР' : 'РЕЗЕРВ');
    }
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
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, colIndex).setValue(value);
    }
  }
}

function broadcastMessage(html, subSheet) {
  if (!subSheet) return;
  const data = subSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) sendTelegramText(String(data[i][0]), html);
  }
}

function sendTelegramText(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log("Send Error: " + e.message);
  }
}

function getOrCreateSheet(doc, name, headers) {
  let s = doc.getSheetByName(name);
  if (!s) {
    s = doc.insertSheet(name);
    s.appendRow(headers);
    s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    s.setFrozenRows(1);
  }
  return s;
}

function formatRows(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  for (let i = 1; i < data.length; i++) {
    const rowIdx = i + 1;
    const type = data[i][2];
    const status = data[i][3];
    const rank = data[i][8];
    const processed = data[i][11];
    const range = sheet.getRange(rowIdx, 1, 1, 12);

    if (status === 'ЗАКРЫТ') {
      range.setBackground('#eeeeee').setFontColor('#999999');
    } else if (type === 'ORDER' && processed === 'Y') {
      range.setBackground('#e8f5e9');
    } else if (type === 'OFFER') {
      range.setBackground('#fffde7');
      const rankCell = sheet.getRange(rowIdx, 9);
      if (rank === 'ЛИДЕР') {
        rankCell.setBackground('#c8e6c9').setFontColor('#1b5e20').setFontWeight('bold');
      } else {
        rankCell.setBackground('#fff9c4').setFontColor('#fbc02d').setFontWeight('bold');
      }
    } else {
      range.setBackground(null).setFontColor(null);
    }
  }
}

function applyBorders(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  sheet.getRange(2, 1, lastRow - 1, 12).setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatNewOrderMessage(order) {
  return `🔥 <b>НОВЫЙ ЗАКАЗ</b>\nID: <code>${order.id}</code>\nКлиент: <b>${order.clientName}</b>\nVIN: <code>${order.vin}</code>\n\n🌍 <a href="${WEBAPP_URL}">Открыть Маркетплейс</a>`;
}

function setWebhook() {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${WEBAPP_URL}`;
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}