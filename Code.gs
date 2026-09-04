var SHEET_ID = "1InpMhSblpJvz1LogFvvqEv4-YXaiPoQmSn_7bNZvais";

var COLUMNS = [
  "submitted_at",
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "age_at_deadline",
  "location",
  "eligibility_fi",
  "problems",
  "future",
  "blocker",
  "main_link",
  "main_link_why",
  "other_links",
  "who_to_meet",
  "success",
  "commitment",
  "commitment_detail",
  "passport_valid",
  "us_entry",
  "source",
  "source_detail",
  "referral",
  "gdpr_consent",
  "future_contact",
  "user_agent"
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
    }

    var row = COLUMNS.map(function (col) {
      return data[col] !== undefined ? String(data[col]) : "";
    });

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: "Byte 3 form backend is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}
