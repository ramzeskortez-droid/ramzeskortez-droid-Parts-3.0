/**
 * КОНФИГУРАЦИЯ
 */
const TELEGRAM_TOKEN = '8584425867:AAFbjHHrSLYx6hdiXnNaaBx2dR7cD9NG2jw';
// URL развернутого веб-приложения (обновите после публикации)
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

/**
 * ТОЧКИ ВХОДА (GET / POST)
 */
function doGet(e) {
  const action = e.parameter.action;
  
  // Если React запрашивает данные
  if (action === 'getData') {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName('MarketData');
    if (!sheet) return response([]);
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);
    return response(rows.map(r => ({
      id: r[0], parentId: r[1], type: r[2], status: r[3], vin: r[4], 
      clientName: r[5], itemName: r[6], itemQty: r[7], itemPrice: r[8],
      json: r[9], createdAt: r[10], location: r[11], visibleToClient: r[12], rank: r[13], comment: r[14]
    })));
  }

  return response({status: "alive", message: "Marketplace API is working"});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Предотвращаем конфликты при одновременной записи
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(doc, 'MarketData', ['ID', 'Parent ID', 'Тип', 'Статус', 'VIN', 'Имя', 'Деталь', 'Кол-во', 'Цена', 'Данные (JSON)', 'Дата', 'Локация', 'Видимость', 'Ранг', 'Комментарий']);
    const subSheet = getOrCreateSheet(doc, 'Subscribers', ['ChatID', 'Username', 'Date']);

    if (!e.postData) return response({error: "No post data"});
    const contents = JSON.parse(e.postData.contents);

    // 1. ОБРАБОТКА TELEGRAM
    if (contents.message || contents.callback_query) {
      handleTelegramUpdate(contents, subSheet);
      return response({status: 'telegram_ok'});
    }

    // 2. ОБРАБОТКА REACT APP
    const body = contents;
    
    // Создание Заказа или Предложения
    if (body.action === 'create') {
      processCreateAction(body.order, sheet, subSheet);
    } 
    
    // Обновление ранга (Лидер/Резерв)
    else if (body.action === 'update_rank') {
      updateOfferRank(body, sheet);
    }
    
    // Формирование КП (Делаем предложения видимыми для клиента)
    else if (body.action === 'form_cp') {
      const { orderId } = body;
      const data = sheet.getDataRange().getValues();
      let changed = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(orderId) && data[i][13] === 'ЛИДЕР') {
          sheet.getRange(i + 1, 13).setValue('Y');
          changed = true;
        }
      }
      if (changed) broadcastMessage(`✅ <b>КП СФОРМИРОВАНО</b>\nЗаказ: <code>${orderId}</code>`, subSheet);
    }

    // Закрытие заказа
    else if (body.action === 'close_order') {
      const { orderId } = body;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(orderId) || String(data[i][1]) === String(orderId)) {
          sheet.getRange(i + 1, 4).setValue('ЗАКРЫТ');
        }
      }
    }

    // После любых изменений обновляем визуальный стиль
    applyBorders(sheet);
    formatRows(sheet);

    return response({status: 'ok'});

  } catch (err) {
    return response({error: err.toString()});
  } finally {
    lock.releaseLock();
  }
}

/**
 * ЛОГИКА СОЗДАНИЯ ЗАПИСЕЙ
 */
function processCreateAction(o, sheet, subSheet) {
  if (o.type === 'ORDER') {
    const rowsToInsert = o.items.map(item => [
      o.id, '', o.type, o.status, o.vin, o.clientName, 
      item.name, item.quantity, '', JSON.stringify(item), 
      o.createdAt, o.location, 'Y', '', ''
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
    broadcastMessage(formatNewOrderMessage(o), subSheet);
  } else {
    // Логика для OFFER: вставка под родительский ORDER
    o.items.forEach(item => {
      if (item.offeredQuantity > 0) {
        const row = [o.id, o.parentId, 'OFFER', o.status, o.vin, o.clientName, item.name, item.offeredQuantity, item.sellerPrice, JSON.stringify(item), o.createdAt, o.location, 'N', 'РЕЗЕРВ', ''];
        
        const data = sheet.getDataRange().getValues();
        let insertIdx = -1;
        for (let i = data.length - 1; i >= 1; i--) {
          if ((String(data[i][0]) === String(o.parentId) || String(data[i][1]) === String(o.parentId)) && String(data[i][6]) === String(item.name)) {
            insertIdx = i + 2;
            break;
          }
        }
        if (insertIdx !== -1) {
          sheet.insertRowBefore(insertIdx);
          sheet.getRange(insertIdx, 1, 1, row.length).setValues([row]);
        } else {
          sheet.appendRow(row);
        }
      }
    });
    broadcastMessage(`💰 <b>НОВОЕ ПРЕДЛОЖЕНИЕ</b>\nК заказу: <code>${o.parentId}</code>\nОт: ${o.clientName}`, subSheet);
  }
}

function updateOfferRank(body, sheet) {
  const { vin, detailName, leadOfferId } = body;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4]) === String(vin) && String(data[i][6]) === String(detailName) && data[i][2] === 'OFFER') {
      const isTarget = String(data[i][0]) === String(leadOfferId);
      sheet.getRange(i + 1, 14).setValue(isTarget ? 'ЛИДЕР' : 'РЕЗЕРВ');
    }
  }
}

/**
 * РАБОТА С TELEGRAM
 */
function handleTelegramUpdate(contents, subSheet) {
  const msg = contents.message;
  if (!msg || !msg.text) return;
  
  const chatId = String(msg.chat.id); // Принудительно в строку
  const text = msg.text.trim();
  const username = msg.from.username || msg.from.first_name || 'NoName';

  if (text === '/start') {
    const data = subSheet.getDataRange().getValues();
    // Проверяем наличие, приводя всё к строкам и убирая лишние пробелы
    const exists = data.some(row => String(row[0]).trim() === chatId.trim());
    
    if (!exists) {
      subSheet.appendRow([chatId, username, new Date()]);
      sendTelegramText(chatId, `👋 Привет, ${username}! Ты добавлен в базу.`);
    } else {
      sendTelegramText(chatId, `ℹ️ Ты уже есть в базе, всё в порядке!`);
    }
  }
}

function broadcastMessage(htmlText, subSheet) {
  const data = subSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) sendTelegramText(String(data[i][0]), htmlText);
  }
}

function sendTelegramText(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
}

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
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

function formatNewOrderMessage(order) {
  let carStr = "Не указано";
  try {
    const car = order.car || (order.items && order.items[0] && order.items[0].carDetails);
    if (car) carStr = `${car.brand || ''} ${car.model || ''} ${car.year || ''}`.trim();
  } catch(e) {}

  let msg = `🔥 <b>НОВЫЙ ЗАКАЗ</b>\n`;
  msg += `🆔 ID: <code>${order.id}</code>\n`;
  msg += `👤 Клиент: <b>${order.clientName}</b>\n`;
  msg += `🚗 Авто: <b>${carStr}</b>\n`;
  msg += `🔢 VIN: <code>${order.vin}</code>\n\n`;
  msg += `📋 <b>ПОЗИЦИИ:</b>\n`;
  
  if (order.items) {
    order.items.forEach((item, idx) => {
      msg += `${idx + 1}. <b>${item.name}</b> (${item.quantity} шт)\n`;
    });
  }
  msg += `\n🌍 <a href="${WEBAPP_URL}">Открыть панель управления</a>`;
  return msg;
}

function formatRows(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  for (let i = 1; i < data.length; i++) {
    const rowIdx = i + 1;
    const status = data[i][3];      // Статус
    const isVisible = data[i][12];   // Видимость (Y/N)
    const type = data[i][2];        // ORDER/OFFER

    if (status === 'ЗАКРЫТ') {
      sheet.getRange(rowIdx, 1, 1, 15).setBackground('#eeeeee').setFontColor('#999999');
    } else if (type === 'OFFER' && isVisible === 'Y') {
      sheet.getRange(rowIdx, 1, 1, 15).setBackground('#e8f5e9'); // Светло-зеленый (в КП)
    } else if (type === 'OFFER') {
      sheet.getRange(rowIdx, 1, 1, 15).setBackground('#fffde7'); // Светло-желтый (предложение)
    } else {
      sheet.getRange(rowIdx, 1, 1, 15).setBackground(null).setFontColor(null);
    }
  }
}

function applyBorders(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 15);
  range.setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Запустить один раз из редактора для привязки бота к скрипту
function setWebhook() {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${WEBAPP_URL}`;
  const res = UrlFetchApp.fetch(url);
  Logger.log(res.getContentText());
}

function testOrderNotification() {
  const subSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Subscribers');
  const testOrder = {
    id: "TEST-123",
    clientName: "Дмитрий (Тест)",
    vin: "TESTVIN123456789",
    items: [{ name: "Тестовая деталь", quantity: 1 }]
  };
  
  // Вызываем ту же функцию, которую вызывает React
  const msg = formatNewOrderMessage(testOrder);
  broadcastMessage(msg, subSheet);
}