/**
 * ============================================================================
 * ON THIN ICE — Google Apps Script Backend (Code.gs)
 * Spreadsheet ID: 1H1mOeMVX1mFlmtD_1sYIofmIDL7YIVa1kAxfuxRmcCk
 * ============================================================================
 * หน้าที่หลัก:
 * 1. อ่านรายชื่อผู้เข้าร่วมทั้ง 39 คน และสถานะการลงทะเบียนจากชีต "Group"
 * 2. บันทึกสถานะ "Registered" ลงในคอลัมน์ Status ข้างชื่อในชีต "Group" แบบ Real-time
 * 3. บันทึกประวัติการลงทะเบียน (Timestamp, ชื่อ, กลุ่ม, อุปกรณ์) ลงในชีต "Log"
 * 4. ใช้ LockService ป้องกันข้อมูลชนกันกรณีสแกน QR Code พร้อมกันหลายคน
 * 5. รองรับทั้งการเปิดผ่าน Google Apps Script Web App โดยตรง และการเรียกผ่าน Fetch API
 * ============================================================================
 */

const SPREADSHEET_ID = '1H1mOeMVX1mFlmtD_1sYIofmIDL7YIVa1kAxfuxRmcCk';
const GROUP_SHEET_NAME = 'Group';
const LOG_SHEET_NAME = 'Log';

// โครงสร้างคอลัมน์ในชีต "Group" (0-based index)
// A: Group 1 | B: Status | C: Group 2 | D: Status | E: Group 3 | F: Status | G: Group 4 | H: Status | I: Group 5 | J: Status
const GROUP_COLUMNS = [
  { groupId: 'G1', groupName: 'Group 1', nameCol: 0, statusCol: 1 },
  { groupId: 'G2', groupName: 'Group 2', nameCol: 2, statusCol: 3 },
  { groupId: 'G3', groupName: 'Group 3', nameCol: 4, statusCol: 5 },
  { groupId: 'G4', groupName: 'Group 4', nameCol: 6, statusCol: 7 },
  { groupId: 'G5', groupName: 'Group 5', nameCol: 8, statusCol: 9 }
];

/**
 * รองรับ HTTP GET:
 * - ?action=getState -> คืนค่า JSON สถานะผู้เข้าร่วมทั้งหมด 39 คน
 * - ?action=register&name=... -> ลงทะเบียนผู้เข้าร่วมและคืนค่า JSON ล่าสุด
 * - ?action=reset -> รีเซ็ตสถานะการลงทะเบียนทั้งหมดเพื่อเริ่มกิจกรรมใหม่
 * - ไม่มี action -> แสดงหน้าเว็บ HTML (กรณีรันผ่าน Google Apps Script HtmlService)
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = (params.action || '').toLowerCase();

  try {
    if (action === 'getstate' || action === 'state') {
      return createJsonResponse(getExpeditionState());
    }

    if (action === 'register') {
      const name = params.name || '';
      const device = params.device || 'QR / Web Client';
      return createJsonResponse(registerParticipant(name, device));
    }

    if (action === 'reset') {
      return createJsonResponse(resetAllRegistrations(params.device || 'Admin Reset'));
    }

    // กรณีเปิดลิงก์ Web App ตรงๆ บนเบราว์เซอร์
    const template = HtmlService.createTemplateFromFile('index');
    template.initialPage = params.page || '1';
    return template.evaluate()
      .setTitle('ON THIN ICE — 06 NOV 2026 | Expedition Registration')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (err) {
    return createJsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/**
 * รองรับ HTTP POST สำหรับการส่งคำสั่งลงทะเบียนหรือรีเซ็ตผ่าน fetch POST
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = (payload.action || '').toLowerCase();

    if (action === 'register') {
      return createJsonResponse(registerParticipant(payload.name, payload.device || 'Web Client'));
    }

    if (action === 'reset') {
      return createJsonResponse(resetAllRegistrations(payload.device || 'Admin Reset'));
    }

    if (action === 'getstate' || action === 'state') {
      return createJsonResponse(getExpeditionState());
    }

    return createJsonResponse({
      ok: false,
      error: 'Unknown action: ' + action
    });
  } catch (err) {
    return createJsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/**
 * อ่านข้อมูลรายชื่อและสถานะล่าสุดจากชีต "Group"
 */
function getExpeditionState() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(GROUP_SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  const participants = [];
  let registeredCount = 0;

  // เริ่มอ่านตั้งแต่แถวที่ 2 (index 1) เป็นต้นไป
  for (let rowIdx = 1; rowIdx < values.length; rowIdx++) {
    const row = values[rowIdx];
    for (let g = 0; g < GROUP_COLUMNS.length; g++) {
      const colSpec = GROUP_COLUMNS[g];
      const rawName = row[colSpec.nameCol];
      if (rawName !== undefined && rawName !== null && String(rawName).trim() !== '') {
        const cleanName = String(rawName).trim();
        const rawStatus = row[colSpec.statusCol] ? String(row[colSpec.statusCol]).trim() : '';
        const isRegistered = rawStatus !== '' && rawStatus.toLowerCase() !== 'unregistered' && rawStatus.toLowerCase() !== 'pending';

        if (isRegistered) {
          registeredCount++;
        }

        participants.push({
          name: cleanName,
          group: colSpec.groupId,
          groupName: colSpec.groupName,
          registered: isRegistered,
          statusText: rawStatus,
          row: rowIdx + 1,
          statusCol: colSpec.statusCol + 1
        });
      }
    }
  }

  return {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    totalCount: participants.length,
    registeredCount: registeredCount,
    remainingCount: participants.length - registeredCount,
    updatedAt: new Date().toISOString(),
    participants: participants
  };
}

/**
 * ลงทะเบียนผู้เข้าร่วมตามชื่อ พร้อมบันทึกสถานะลงชีต "Group" และเพิ่มประวัติลงชีต "Log"
 */
function registerParticipant(targetName, deviceInfo) {
  if (!targetName || String(targetName).trim() === '') {
    return { ok: false, error: 'กรุณาระบุชื่อผู้เข้าร่วม' };
  }

  const normalizedTarget = String(targetName).trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // ป้องกัน Race Condition เมื่อกดพร้อมกันหลายคน

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const groupSheet = ss.getSheetByName(GROUP_SHEET_NAME) || ss.getSheets()[0];
    const values = groupSheet.getDataRange().getValues();

    let foundRecord = null;
    let alreadyRegistered = false;

    for (let rowIdx = 1; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx];
      for (let g = 0; g < GROUP_COLUMNS.length; g++) {
        const colSpec = GROUP_COLUMNS[g];
        const cellName = row[colSpec.nameCol] ? String(row[colSpec.nameCol]).trim() : '';

        if (cellName && cellName.toLowerCase() === normalizedTarget) {
          const currentStatus = row[colSpec.statusCol] ? String(row[colSpec.statusCol]).trim() : '';
          alreadyRegistered = currentStatus !== '';

          const now = new Date();
          const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
          const statusValue = 'Registered (' + Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Bangkok', 'HH:mm:ss') + ')';

          // อัปเดตช่อง Status ในชีต "Group"
          if (!alreadyRegistered) {
            groupSheet.getRange(rowIdx + 1, colSpec.statusCol + 1).setValue(statusValue);
          }

          foundRecord = {
            name: cellName,
            group: colSpec.groupId,
            groupName: colSpec.groupName,
            registered: true,
            alreadyRegistered: alreadyRegistered,
            timestamp: timeStr
          };

          // บันทึกลงชีต "Log"
          appendRegistrationLog(ss, {
            timestamp: timeStr,
            name: cellName,
            groupId: colSpec.groupId,
            groupName: colSpec.groupName,
            action: alreadyRegistered ? 'DUPLICATE_CLICK' : 'REGISTERED',
            device: deviceInfo || 'Web App'
          });

          break;
        }
      }
      if (foundRecord) break;
    }

    if (!foundRecord) {
      return {
        ok: false,
        error: 'ไม่พบรายชื่อ "' + targetName + '" ในระบบ'
      };
    }

    SpreadsheetApp.flush();
    const latestState = getExpeditionState();
    latestState.registeredParticipant = foundRecord;
    return latestState;
  } finally {
    lock.releaseLock();
  }
}

/**
 * รีเซ็ตสถานะการลงทะเบียนทั้งหมดในชีต "Group" (สำหรับผู้จัดงานใช้ทดสอบหรือเริ่มงานใหม่)
 */
function resetAllRegistrations(deviceInfo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const groupSheet = ss.getSheetByName(GROUP_SHEET_NAME) || ss.getSheets()[0];
    const lastRow = groupSheet.getLastRow();

    if (lastRow >= 2) {
      // ล้างเฉพาะคอลัมน์ Status (B, D, F, H, J)
      GROUP_COLUMNS.forEach(function(colSpec) {
        groupSheet.getRange(2, colSpec.statusCol + 1, lastRow - 1, 1).clearContent();
      });
    }

    const now = new Date();
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    appendRegistrationLog(ss, {
      timestamp: timeStr,
      name: '[SYSTEM RESET]',
      groupId: 'ALL',
      groupName: 'All Groups',
      action: 'RESET_ALL_STATUS',
      device: deviceInfo || 'Admin'
    });

    SpreadsheetApp.flush();
    return getExpeditionState();
  } finally {
    lock.releaseLock();
  }
}

/**
 * สร้างหรือเพิ่มแถวข้อมูลในชีต "Log"
 */
function appendRegistrationLog(ss, entry) {
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.appendRow(['Timestamp', 'Name', 'Group ID', 'Group Name', 'Action', 'Device / Source']);
    logSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#0B2545').setFontColor('#FFFFFF');
    logSheet.setFrozenRows(1);
  }

  logSheet.appendRow([
    entry.timestamp,
    entry.name,
    entry.groupId,
    entry.groupName,
    entry.action,
    entry.device
  ]);
}

/**
 * Helper สำหรับส่งออก JSON Response
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
